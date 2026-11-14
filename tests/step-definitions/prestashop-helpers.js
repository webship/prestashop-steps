'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds what
// the steps share and what a downstream pack can require instead of copying:
// the wait budget, friendly errors, the accounts registries, the back-office
// session and its security token, the messages, the three kinds of dialogs,
// the lists (grids) of the back office and the `prestashop` object of the shop.
//
// Every lookup here was written from a page opened in a real browser on a real
// install (9.2.1, default theme). The back office mixes two page generations,
// and the helpers know both:
//
//   new pages     /<admin>/sell/…, /improve/…, /configure/…   (Symfony)
//   legacy pages  /<admin>/index.php?controller=Admin…         (Dashboard, Cart Rules, Customer Service…)

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Small tools
// ---------------------------------------------------------------------------

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/**
 * Whether an optional step argument was supplied.
 *
 * @param {*} value
 * @returns {boolean}
 */
function supplied(value) {
  return value !== undefined && value !== null;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A RegExp that matches the literal text anywhere. */
function literal(text) {
  return new RegExp(escapeRegExp(text));
}

/** A RegExp that matches the whole text, ignoring the space around it. */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*$');
}

/** Collapse white space the way a reader does. */
function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Open a URL and wait for the page to settle.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  await gotoUrl(world.page, url);
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/** Wait for the page that a click started to load. */
async function settle(world) {
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await smartSettle(world.page, 1500);
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack.
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise.
 */
async function assertPresence(locator, notCase, { label, hint, timeout, found }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    const seen = found ? await found().catch(() => '') : '';
    throw friendly({
      message: (notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`) + (seen ? ` Found instead: ${seen}.` : ''),
      hint,
    });
  }
}

/**
 * Poll a reading until it satisfies a test, and fail with a friendly error that
 * names what was expected and what was found.
 *
 * @param {object} world
 * @param {Function} read    async () => value
 * @param {Function} test    (value) => boolean
 * @param {Function} explain (value) => {message, hint}
 * @returns {Promise<*>} the last value read
 */
async function waitUntil(world, read, test, explain) {
  const deadline = Date.now() + budget(world);
  let value;
  for (;;) {
    value = await read().catch(() => undefined);
    if (value !== undefined && test(value)) return value;
    if (Date.now() > deadline) throw friendly(explain(value));
    await world.page.waitForTimeout(200);
  }
}

/** What this pack remembers during a scenario (the order placed, for example). */
function memory(world) {
  if (!world.shopMemory) world.shopMemory = {};
  return world.shopMemory;
}

// ---------------------------------------------------------------------------
// Accounts (configuration, never test data)
// ---------------------------------------------------------------------------

/**
 * An account of a registry in cucumber.js: `worldParameters.employees` for the
 * back office, `worldParameters.customers` for the shop.
 *
 * @param {object} world
 * @param {'employees'|'customers'} registry
 * @param {string} handle
 * @returns {{email: string, password: string, name: string}}
 */
function resolveAccount(world, registry, handle) {
  const accounts = (world.parameters && world.parameters[registry]) || {};
  const entry = accounts[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the ${registry} registry. Known: ${Object.keys(accounts).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.${registry} in cucumber.js: ${handle}: { email: '…', password: process.env.…, name: '…' }. The account itself is created once by the site build script, never by a feature.`,
    });
  }
  if (!entry.email || !entry.password) {
    throw friendly({
      message: `The account "${handle}" of the ${registry} registry has no e-mail or no password.`,
      hint: `Set worldParameters.${registry}.${handle}.email and .password in cucumber.js.`,
    });
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Back office: address, session, token
// ---------------------------------------------------------------------------

/** The folder of the back office (it is random on a default install; the build script pins it). */
function adminFolder(world) {
  const configured = world.parameters && world.parameters.backOffice && world.parameters.backOffice.folder;
  return String(configured || 'admin-steps').replace(/^\/+|\/+$/g, '');
}

function adminRoot(world) {
  return siteRoot(world) + '/' + adminFolder(world);
}

const BO_HINT = 'Open the back office in a browser and compare: new pages and legacy pages (index.php?controller=Admin…) render the header, lists and messages differently.';

/** Sign-out link: the one id the two page generations share. */
function signOutLink(page) {
  return page.locator('a#header_logout');
}

/** The toggle of the employee menu: new pages, then legacy pages. */
function employeeToggle(page) {
  return page.locator('#header-employee-container [data-toggle="dropdown"], #employee_infos a.employee_name');
}

/** The greeting inside the employee menu ("Welcome back Shop"). */
function employeeGreeting(page) {
  return page.locator('#header-employee-container .employee_profile, #employee_links .username');
}

/** Whether an employee session is open on the current page. */
async function employeeSignedIn(page) {
  return (await signOutLink(page).count()) > 0;
}

/**
 * Fill and send the sign-in form of the back office.
 * The page holds a second, hidden form (password reset) whose e-mail field has
 * the same label, so the fields are taken by their own ids.
 */
async function sendEmployeeSignIn(world, email, password) {
  const page = world.page;
  await open(world, adminRoot(world) + '/');
  if (await employeeSignedIn(page)) {
    await page.goto(await signOutLink(page).first().getAttribute('href').then((href) => new URL(href, page.url()).href));
    await settle(world);
  }
  await actOrExplain('fill in the sign-in form of', 'the back office', async () => {
    await page.locator('#login_form input#email').fill(email, { timeout: budget(world) });
    await page.locator('#login_form input#passwd').fill(password);
    await page.locator('#login_form #submit_login').click();
  }, `The sign-in form (#login_form with #email, #passwd, #submit_login) was not found at ${adminRoot(world)}/. Check backOffice.folder in cucumber.js (ADMIN_FOLDER): a default install gives the back office a random folder name.`);
  await settle(world);
}

/** Sign in as an employee and fail with a helpful message when the back office refuses. */
async function employeeSignIn(world, account, handle) {
  await sendEmployeeSignIn(world, account.email, account.password);
  if (!(await employeeSignedIn(world.page))) {
    const refused = clean(await world.page.locator('.alert-danger:visible').first().innerText().catch(() => ''));
    throw friendly({
      message: `Could not log in to the back office as "${handle}" (${account.email}).` + (refused ? ` The page says: ${refused.replace(/^close\s*/, '')}` : ` The page is ${world.page.url().split('?')[0]}.`),
      hint: 'The employee must exist with that password: the site build script creates the accounts of worldParameters.employees.',
    });
  }
}

/**
 * The security token of the session, read from a link of the page. Without it
 * a back-office address answers with the "Invalid token" page.
 */
async function sessionToken(world) {
  const href = await world.page.locator('nav.nav-bar a[href*="_token="], a[href*="_token="]').first().getAttribute('href', { timeout: budget(world) }).catch(() => null);
  const token = href && new URL(href, world.page.url()).searchParams.get('_token');
  if (!token) {
    throw friendly({
      message: 'No security token was found on the page, so a back-office address cannot be opened.',
      hint: 'Log in to the back office first and stay on one of its pages: the token is read from the links of the main menu.',
    });
  }
  return token;
}

/** The address of a back-office path with the session token. */
async function adminPathUrl(world, path, withToken = true) {
  const clean = String(path).replace(/^\/+/, '');
  let url = adminRoot(world) + '/' + clean;
  if (withToken) url += (url.includes('?') ? '&' : '?') + '_token=' + encodeURIComponent(await sessionToken(world));
  return url;
}

// ---------------------------------------------------------------------------
// Back office: main menu
// ---------------------------------------------------------------------------

const MENU = 'nav.nav-bar ul.main-menu';

/** The visible label of a menu entry (its icon is text too, in an <i>). */
function menuLabelScript() {
  return (li) => {
    const link = li.querySelector(':scope > a');
    if (!link) return '';
    const span = link.querySelector('span');
    return ((span || link).textContent || '').replace(/\s+/g, ' ').trim();
  };
}

/**
 * The entries of the main menu as a person reads them:
 * [{label, children: [label…], current}].
 */
async function menuEntries(world) {
  return world.page.locator(`${MENU} > li.link-levelone`).evaluateAll((items) => items.map((li) => {
    const label = (node) => {
      const link = node.querySelector(':scope > a');
      const span = link && link.querySelector('span');
      return ((span || link || node).textContent || '').replace(/\s+/g, ' ').trim();
    };
    return {
      label: label(li),
      current: /link-levelone-active|link-active/.test(li.className),
      children: [...li.querySelectorAll('ul.submenu > li')].map((sub) => ({ label: label(sub), current: /link-active/.test(sub.className) })),
    };
  }));
}

/**
 * The link of a menu entry, from "Catalog" or "Catalog > Products".
 *
 * @returns {Promise<import('playwright').Locator>}
 */
async function menuLink(world, path) {
  const [parent, child] = String(path).split('>').map((part) => part.trim());
  // From a page of the shop (or a blank page), go to the back office first: its session is kept.
  if (!(await world.page.locator(MENU).count())) {
    await open(world, adminRoot(world) + '/');
    if (!(await employeeSignedIn(world.page))) {
      throw friendly({
        message: `Could not open "${path}" in the back office menu: no employee is logged in.`,
        hint: 'Log in to the back office first ("I am logged in to the back office as …").',
      });
    }
  }
  await world.page.locator(MENU).first().waitFor({ state: 'attached', timeout: budget(world) }).catch(() => {});
  const entries = await menuEntries(world);
  const top = entries.findIndex((entry) => entry.label === parent);
  const describe = () => entries.map((entry) => entry.label + (entry.children.length ? ' [' + entry.children.map((sub) => sub.label).join(', ') + ']' : '')).join('; ') || '(no menu on this page)';
  if (top < 0) {
    throw friendly({
      message: `The main menu has no entry "${parent}". It has: ${describe()}.`,
      hint: 'An employee only sees the entries its profile may open. Write the entry as the menu shows it, for example "Catalog > Products".',
    });
  }
  const item = world.page.locator(`${MENU} > li.link-levelone`).nth(top);
  if (!child) return item.locator(':scope > a');
  const sub = entries[top].children.findIndex((entry) => entry.label === child);
  if (sub < 0) {
    throw friendly({
      message: `The menu entry "${parent}" has no item "${child}". It has: ${entries[top].children.map((entry) => entry.label).join(', ') || '(nothing)'}.`,
      hint: 'Write the item as the open menu shows it, for example "Orders > Shopping Carts".',
    });
  }
  return item.locator('ul.submenu > li').nth(sub).locator(':scope > a');
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_TYPES = { success: 'success', error: 'danger', danger: 'danger', warning: 'warning', info: 'info' };

/**
 * The visible messages of one type, in the back office (new and legacy pages)
 * and in the shop: `.alert.alert-<type>`. The pages also hold hidden, empty
 * alerts (`#ajax_confirmation`), so only visible ones count.
 *
 * @param {object} world
 * @param {string} type success, error, warning or info
 * @param {string} [text]
 * @returns {import('playwright').Locator}
 */
function messages(world, type, text) {
  const kind = MESSAGE_TYPES[String(type).toLowerCase()];
  let locator = world.page.locator(`.alert.alert-${kind}:visible`);
  if (supplied(text) && text !== '') locator = locator.filter({ hasText: literal(text) });
  return locator;
}

/** The texts of the visible messages, for error reports. */
async function messagesSeen(world) {
  const texts = await world.page.locator('.alert:visible, .growl:visible').evaluateAll((nodes) => nodes
    .filter((node) => !/alert-info/.test(node.className) || node.closest('#notifications, #content-message-box, .js-cart-update-alert'))
    .map((node) => {
      const kind = (node.className.match(/alert-(success|danger|warning|info)/) || [null, 'notification'])[1];
      return `${kind === 'danger' ? 'error' : kind}: "${(node.innerText || '').replace(/\s+/g, ' ').replace(/^(close|×)\s*/, '').trim()}"`;
    }));
  return texts.join(', ') || 'no message';
}

/** The notifications that slide in at the top right of the back office after an AJAX action. */
function notifications(world, text) {
  let locator = world.page.locator('#growls-default .growl:visible, #growls .growl:visible, .growl:visible');
  if (supplied(text) && text !== '') locator = locator.filter({ hasText: literal(text) });
  return locator;
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

// Three kinds of dialogs ask for a confirmation:
//   1. the Bootstrap dialog of the new pages and of the shop: `.modal.show`, title `.modal-title`;
//   2. the jQuery alerts popup of the legacy pages: `#popup_container` with `#popup_ok` / `#popup_cancel`;
//   3. (none seen) a browser dialog: webship-js has steps for those.
const DIALOG = '.modal.show:visible, #popup_container:visible';
const DIALOG_HINT = 'A dialog is a Bootstrap dialog (.modal.show) on new pages and in the shop, and the popup #popup_container on legacy pages.';

function dialog(world) {
  return world.page.locator(DIALOG).first();
}

/** The title and the text of the open dialog. */
async function dialogText(world) {
  return clean(await dialog(world).innerText().catch(() => ''));
}

/**
 * Press the confirming (`accept`) or the cancelling control of the open dialog.
 * In every dialog seen, the confirming control is the last one of the footer
 * (a button, or a link without href) and "Cancel" is the first.
 */
async function answerDialog(world, accept) {
  const page = world.page;
  const box = dialog(world);
  try {
    await box.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `Expected a confirmation dialog to ${accept ? 'confirm' : 'cancel'}, but none is open.`, hint: DIALOG_HINT });
  }
  const handle = await box.elementHandle();
  const legacy = (await box.getAttribute('id')) === 'popup_container';
  const controls = legacy ? box.locator(accept ? '#popup_ok' : '#popup_cancel') : box.locator('.modal-footer button:visible, .modal-footer a:visible, .modal-footer input[type="button"]:visible');
  const control = legacy || accept ? controls.last() : controls.first();
  await actOrExplain(accept ? 'confirm' : 'cancel', 'the dialog', () => control.click({ timeout: budget(world) }), DIALOG_HINT);
  // The dialog closes, or the page it belongs to is replaced.
  await page.waitForFunction((node) => !node.isConnected || !(node.offsetWidth || node.offsetHeight) || !node.classList.contains('show') && node.id !== 'popup_container', handle, { timeout: budget(world) }).catch(() => {});
  await settle(world);
}

// ---------------------------------------------------------------------------
// Back office: lists (grids)
// ---------------------------------------------------------------------------

const GRID = 'table.js-grid-table:visible, table.table[id^="table-"]:visible';
const GRID_HINT = 'New pages render a list as table.js-grid-table (filters in tr.column-filters, actions in td.column-actions); legacy pages as table.table#table-<name>.';

/** The list of the page. */
async function grid(world) {
  const table = world.page.locator(GRID).first();
  try {
    await table.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `Expected a list on the page, but found none at ${world.page.url().split('?')[0]}.`, hint: GRID_HINT });
  }
  return table;
}

/** The rows of the list that hold a record (the "No records found" row is not one). */
function gridRows(table) {
  return table.locator('tbody > tr:has(td:nth-child(2))');
}

/** The first row of the list that shows the text. */
async function gridRow(world, text) {
  const table = await grid(world);
  const row = gridRows(table).filter({ hasText: literal(text) }).first();
  try {
    await row.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    const seen = (await gridRows(table).evaluateAll((rows) => rows.slice(0, 8).map((row) => row.innerText.replace(/\s+/g, ' ').trim().slice(0, 70)))).join(' | ');
    throw friendly({
      message: `Expected a row with "${text}" in the list, but there is none. The list shows: ${seen || 'no rows'}.`,
      hint: 'A list remembers its filters for the employee: reset them, or look on another page of the list.',
    });
  }
  return row;
}

/** The titles of the columns, in order (an empty title for the checkbox and action columns). */
async function gridColumns(table) {
  return table.locator('thead > tr').first().locator('th').evaluateAll((cells) => cells.map((cell) => (cell.innerText || '').replace(/\s+/g, ' ').trim()));
}

/** The position (0-based) of a column by its title. */
async function gridColumnIndex(table, title) {
  const columns = await gridColumns(table);
  const index = columns.findIndex((name) => name === title);
  if (index < 0) {
    throw friendly({
      message: `The list has no column "${title}". Its columns are: ${columns.filter(Boolean).join(', ')}.`,
      hint: 'Write the column title as the list header shows it.',
    });
  }
  return index;
}

/**
 * The action of a row, by its name ("Edit", "View", "Delete", "Duplicate"…).
 * The main action is an icon whose name is its tooltip; the others sit in the
 * menu behind the dots (new pages) or the caret (legacy pages), which this opens.
 */
async function gridRowAction(world, row, name) {
  const cell = row.locator('td.column-actions, td:last-child').last();
  const index = await cell.locator('a, button').evaluateAll((controls, wanted) => controls.findIndex((control) => {
    const texts = [control.getAttribute('data-original-title'), control.getAttribute('title'), [...control.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(' ')];
    return texts.some((text) => text && text.replace(/\s+/g, ' ').trim() === wanted);
  }), name);
  if (index < 0) {
    const names = await cell.locator('a, button').evaluateAll((controls) => controls.map((control) => (control.getAttribute('data-original-title') || control.getAttribute('title') || [...control.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(' ')).replace(/\s+/g, ' ').trim()).filter(Boolean));
    throw friendly({ message: `The row has no action "${name}". It has: ${names.join(', ') || '(none)'}.`, hint: GRID_HINT });
  }
  const action = cell.locator('a, button').nth(index);
  if (!(await action.isVisible())) {
    await cell.locator('a.dropdown-toggle-dots, button.dropdown-toggle').first().click({ timeout: budget(world) });
    await action.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return action;
}

// ---------------------------------------------------------------------------
// Back office: forms
// ---------------------------------------------------------------------------

const FIELD_HINT = 'The field is found by the label a person reads next to it (.form-group > label), because many back-office fields have no usable accessible name.';

/**
 * The group of a back-office form field, by its visible label. Labels carry a
 * leading "*" when the field is required; it is not part of the name.
 */
async function fieldGroup(world, label) {
  const page = world.page;
  const groups = page.locator('.form-group:visible').filter({ has: page.locator(':scope > label, :scope > .form-control-label, :scope > .control-label').filter({ hasText: new RegExp('^[\\s*]*' + escapeRegExp(label) + '\\s*$') }) });
  try {
    await groups.first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    const labels = await page.locator('.form-group:visible > label, .form-group:visible > .control-label').evaluateAll((nodes) => nodes.map((node) => node.innerText.replace(/\s+/g, ' ').replace(/^\*\s*/, '').trim()).filter(Boolean).slice(0, 25));
    throw friendly({ message: `The form has no visible field "${label}". Visible fields: ${labels.join(', ') || '(none)'}.`, hint: FIELD_HINT + ' A field of another tab is not visible until its tab is open.' });
  }
  return groups.first();
}

/** The text control (input, textarea or select) of a back-office field. */
async function fieldControl(world, label) {
  const group = await fieldGroup(world, label);
  return group.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):visible, textarea:visible, select:visible').first();
}

// ---------------------------------------------------------------------------
// The shop
// ---------------------------------------------------------------------------

const SHOP_HINT = 'The shop steps read the `prestashop` object of the page, the roles and labels, and the hooks of the default theme of 9.x (body id, #js-product-list, .js-cart-item, #checkout-…-step). Another theme may need its own steps.';

/**
 * What the shop itself says about the visitor, the page and the cart: the
 * `prestashop` object the core puts on every page of any theme.
 *
 * @returns {Promise<{logged: boolean, email: string, page: string, cartCount: number}>}
 */
async function shopState(world) {
  return world.page.evaluate(() => {
    const shop = window.prestashop || {};
    return {
      known: !!window.prestashop,
      logged: !!(shop.customer && shop.customer.is_logged),
      email: (shop.customer && shop.customer.email) || '',
      page: (shop.page && shop.page.page_name) || document.body.id || '',
      cartCount: shop.cart ? Number(shop.cart.products_count) || 0 : 0,
    };
  });
}

/** The address of a shop page by its controller name, which is the same in every language. */
function shopPage(world, controller) {
  return siteRoot(world) + '/index.php?controller=' + controller;
}

/** Sign in as a customer through the sign-in page. */
async function sendCustomerSignIn(world, email, password) {
  await open(world, shopPage(world, 'authentication'));
  if ((await shopState(world)).logged) {
    await open(world, siteRoot(world) + '/?mylogout=');
    await open(world, shopPage(world, 'authentication'));
  }
  const form = world.page.locator('#login-form');
  await actOrExplain('fill in the sign-in form of', 'the shop', async () => {
    await form.locator('input[name="email"]').fill(email, { timeout: budget(world) });
    await form.locator('input[name="password"]').fill(password);
    await form.locator('#submit-login, [data-link-action="sign-in"]').first().click();
  }, 'The sign-in form (#login-form with the fields email and password) was not found on the authentication page.');
  await settle(world);
}

/** The product cards of the page (`.js-product-miniature`, a core hook). */
function productCards(world, scope) {
  return world.page.locator(`${scope ? scope + ' ' : ''}.js-product-miniature:visible`);
}

/** The name on a product card. */
const CARD_TITLE = '.product-miniature__title';

/** The names of the products of the product list, in order. */
async function listedProducts(world) {
  return world.page.locator('#js-product-list .js-product-miniature').evaluateAll((cards, title) => cards.map((card) => ((card.querySelector(title) || {}).textContent || '').replace(/\s+/g, ' ').trim()), CARD_TITLE);
}

/** The lines of the cart page. */
function cartLines(world, name) {
  let lines = world.page.locator('.js-cart-item:visible');
  if (supplied(name)) lines = lines.filter({ hasText: literal(name) });
  return lines;
}

/** The open step of the checkout. */
function checkoutStep(world) {
  return world.page.locator('section[id^="checkout-"][id$="-step"].step--current').first();
}

module.exports = {
  budget,
  supplied,
  escapeRegExp,
  literal,
  exactly,
  clean,
  siteRoot,
  siteUrl,
  open,
  settle,
  actOrExplain,
  assertPresence,
  waitUntil,
  memory,
  resolveAccount,
  adminFolder,
  adminRoot,
  BO_HINT,
  signOutLink,
  employeeToggle,
  employeeGreeting,
  employeeSignedIn,
  sendEmployeeSignIn,
  employeeSignIn,
  sessionToken,
  adminPathUrl,
  MENU,
  menuLabelScript,
  menuEntries,
  menuLink,
  MESSAGE_TYPES,
  messages,
  messagesSeen,
  notifications,
  DIALOG,
  DIALOG_HINT,
  dialog,
  dialogText,
  answerDialog,
  GRID,
  GRID_HINT,
  grid,
  gridRows,
  gridRow,
  gridColumns,
  gridColumnIndex,
  gridRowAction,
  FIELD_HINT,
  fieldGroup,
  fieldControl,
  SHOP_HINT,
  shopState,
  shopPage,
  sendCustomerSignIn,
  productCards,
  CARD_TITLE,
  listedProducts,
  cartLines,
  checkoutStep,
};
