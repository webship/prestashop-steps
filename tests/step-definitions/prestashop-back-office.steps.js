'use strict';

// Back office step definitions: the employee session, the main menu, the page
// header (title and breadcrumb), addresses with the security token, the access
// denied and invalid token pages, messages and notifications, confirmation
// dialogs, the lists (filters, rows, row actions, bulk actions, switches,
// pagination) and the form fields found by their visible label.
//
// The products, categories, orders, modules and discounts have their own file,
// prestashop-catalog.steps.js; the shop is in prestashop-shop.steps.js.
//
// Employees are configuration: `worldParameters.employees` in cucumber.js lists
// them and the site build script creates them. No step creates or deletes one.
//
// Every assertion waits on what it asserts, and every failure says what was
// expected, what was found and where to look.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  supplied,
  literal,
  clean,
  open,
  go,
  settle,
  actOrExplain,
  assertPresence,
  waitUntil,
  resolveAccount,
  adminRoot,
  BO_HINT,
  signOutLink,
  employeeToggle,
  employeeGreeting,
  employeeSignedIn,
  sendEmployeeSignIn,
  employeeSignIn,
  adminPathUrl,
  menuEntries,
  menuLink,
  messages,
  messagesSeen,
  notifications,
  DIALOG_HINT,
  dialog,
  dialogText,
  answerDialog,
  GRID_HINT,
  grid,
  gridRows,
  gridRow,
  gridColumnIndex,
  gridRowAction,
  FIELD_HINT,
  fieldGroup,
  fieldControl,
} = require('./prestashop-helpers');

// ---------------------------------------------------------------------------
// The employee session
// ---------------------------------------------------------------------------

/**
 * Log in to the back office as an employee of the registry
 * (`worldParameters.employees` in cucumber.js), by its handle.
 *
 * Example #1: Given I am logged in to the back office as "admin"
 * Example #2: Given we are logged in to the back office as "admin"
 * Example #3: Given I am logged in to the back office as "salesman"
 * Example #4: Given logged in to the back office as "admin"
 * Example #5: And I am logged in to the back office as "salesman"
 *
 */
Given(/^(I am |we are )?logged in to the back office as "([^"]*)"$/, async function (pronounCase, handle) {
  await employeeSignIn(this, resolveAccount(this, 'employees', handle), handle);
});

/**
 * Send the sign-in form of the back office with an e-mail address and a
 * password, without expecting it to succeed: for the refused sign-in.
 *
 * Example #1: When I log in to the back office with "admin@example.com" and "wrong-password"
 * Example #2: When we log in to the back office with "admin@example.com" and "wrong-password"
 * Example #3: When I log in to the back office with "nobody@example.com" and "Whatever123456789!"
 * Example #4: And I log in to the back office with "salesman@example.com" and "x"
 * Example #5: When log in to the back office with "admin@example.com" and "nope"
 *
 */
When(/^(I |we )*log in to the back office with "([^"]*)" and "([^"]*)"$/, async function (pronounCase, email, password) {
  await sendEmployeeSignIn(this, email, password);
});

/**
 * Log out of the back office through the employee menu of the header, the way
 * a person does: open the menu, press "Sign out".
 *
 * Example #1: When I log out of the back office
 * Example #2: When we log out of the back office
 * Example #3: And I log out of the back office
 * Example #4: Then I log out of the back office
 * Example #5: When log out of the back office
 *
 */
When(/^(I |we )*log out of the back office$/, async function (pronounCase) {
  await actOrExplain('log out of', 'the back office', async () => {
    await employeeToggle(this.page).first().click({ timeout: budget(this) });
    await signOutLink(this.page).first().click({ timeout: budget(this) });
  }, 'The employee menu is the round avatar at the right of the header; its last entry is "Sign out" (a#header_logout). No employee is logged in when it is missing.');
  await settle(this);
});

/**
 * Assert that an employee session is open (the header shows the employee menu
 * with "Sign out") or that it is not (the sign-in form is shown instead).
 *
 * Example #1: Then I should be logged in to the back office
 * Example #2: Then I should not be logged in to the back office
 * Example #3: Then we should be logged in to the back office
 * Example #4: And I should not be logged in to the back office
 * Example #5: Then should be logged in to the back office
 *
 */
Then(/^(I |we )*should( not)* be logged in to the back office$/, async function (pronounCase, notCase) {
  const page = this.page;
  const state = await waitUntil(this,
    async () => ({ in: await employeeSignedIn(page), form: (await page.locator('#login_form #email').count()) > 0 }),
    (now) => (notCase ? !now.in && now.form : now.in),
    (now) => ({
      message: notCase
        ? `Expected no employee session, but ${now && now.in ? 'an employee is logged in' : 'the sign-in form is not shown'} at ${page.url().split('?')[0]}.`
        : `Expected an employee session, but ${now && now.form ? 'the sign-in form is shown' : 'the header has no employee menu'} at ${page.url().split('?')[0]}.`,
      hint: BO_HINT,
    }));
  return state;
});

/**
 * Assert the first name the employee menu greets ("Welcome back Shop").
 *
 * Example #1: Then the back office should greet "Shop"
 * Example #2: Then the back office should greet "Sam"
 * Example #3: And the back office should greet "Shop"
 * Example #4: Then the back office should greet "Welcome back Shop"
 * Example #5: Then the back office should greet "Welcome back Sam"
 *
 */
Then(/^the back office should greet "([^"]*)"$/, async function (name) {
  const page = this.page;
  await waitUntil(this,
    async () => clean(await employeeGreeting(page).first().textContent({ timeout: 2000 })),
    (text) => text.includes(name),
    (text) => ({
      message: `Expected the employee menu to greet "${name}", but it says "${text || 'nothing'}".`,
      hint: 'The greeting is "Welcome back <first name>" inside the employee menu of the header.',
    }));
});

// ---------------------------------------------------------------------------
// Main menu, title, breadcrumb
// ---------------------------------------------------------------------------

/**
 * Open a page from the main menu of the back office, by the labels a person
 * reads: an entry ("Stats") or an entry and its item ("Catalog > Products").
 * The link of the menu carries the security token of the session.
 *
 * Example #1: When I open "Catalog > Products" in the back office menu
 * Example #2: When I open "Orders > Orders" in the back office menu
 * Example #3: When we open "Customers > Customers" in the back office menu
 * Example #4: And I open "Modules > Module Manager" in the back office menu
 * Example #5: When I open "Catalog > Discounts" in the back office menu
 *
 */
When(/^(I |we )*open "([^"]*)" in the back office menu$/, async function (pronounCase, path) {
  const link = await menuLink(this, path);
  const href = await link.getAttribute('href');
  if (await link.isVisible()) {
    await link.click({ timeout: budget(this) });
  } else {
    // The item of a closed entry is in the page but hidden until its entry is open: follow its link.
    await go(this, new URL(href, this.page.url()).href);
  }
  await settle(this);
});

/**
 * Assert that the main menu shows, or does not show, an entry or an item to
 * the employee: a limited profile sees fewer of them.
 *
 * Example #1: Then I should see "Modules" in the back office menu
 * Example #2: Then I should not see "Modules" in the back office menu
 * Example #3: Then I should see "Catalog > Products" in the back office menu
 * Example #4: Then we should not see "Customers > Customers" in the back office menu
 * Example #5: And I should not see "Advanced Parameters > Team" in the back office menu
 *
 */
Then(/^(I |we )*should( not)* see "([^"]*)" in the back office menu$/, async function (pronounCase, notCase, path) {
  const [parent, child] = String(path).split('>').map((part) => part.trim());
  const has = (entries) => {
    const top = entries.find((entry) => entry.label === parent);
    if (!top) return false;
    return child ? top.children.some((sub) => sub.label === child) : true;
  };
  await waitUntil(this,
    () => menuEntries(this),
    (entries) => entries.length > 0 && has(entries) === !notCase,
    (entries) => ({
      message: `Expected the main menu ${notCase ? 'not ' : ''}to show "${path}". It shows: ${(entries || []).map((entry) => entry.label + (entry.children.length ? ' [' + entry.children.map((sub) => sub.label).join(', ') + ']' : '')).join('; ') || '(no menu on this page)'}.`,
      hint: 'The menu lists what the profile of the employee may open (Advanced Parameters > Team > Permissions).',
    }));
});

/**
 * Assert which item of the main menu is the current one, by its label.
 *
 * Example #1: Then the current back office menu item should be "Products"
 * Example #2: Then the current back office menu item should be "Orders"
 * Example #3: Then the current back office menu item should be "Module Manager"
 * Example #4: And the current back office menu item should be "Dashboard"
 * Example #5: Then the current back office menu item should be "Categories"
 *
 */
Then(/^the current back office menu item should be "([^"]*)"$/, async function (label) {
  const current = (entries) => entries.flatMap((entry) => [entry.current ? entry.label : null, ...entry.children.filter((sub) => sub.current).map((sub) => sub.label)]).filter(Boolean);
  await waitUntil(this,
    () => menuEntries(this),
    (entries) => current(entries).includes(label),
    (entries) => ({
      message: `Expected "${label}" to be the current menu item, but the current one is ${current(entries || []).map((name) => `"${name}"`).join(' in ') || 'none'}.`,
      hint: 'The current entry carries link-levelone-active (legacy pages) or link-active (new pages).',
    }));
});

/**
 * Assert the title of the back-office page (its h1). The product page has
 * none; assert its fields instead.
 *
 * Example #1: Then the back office page title should be "Products"
 * Example #2: Then the back office page title should be "Orders"
 * Example #3: Then the back office page title should be "Module manager"
 * Example #4: And the back office page title should be "New category"
 * Example #5: Then the back office page title should be "Cart Rules"
 *
 */
Then(/^the back office page title should be "([^"]*)"$/, async function (title) {
  const page = this.page;
  await waitUntil(this,
    async () => clean(await page.locator('h1:visible').first().innerText({ timeout: 2000 })),
    (text) => text === title,
    (text) => ({
      message: `Expected the page title "${title}", but the page title is "${text || '(none)'}".`,
      hint: 'The title is the h1 of the page (h1.title on new pages, h1.page-title on legacy pages).',
    }));
});

/**
 * Assert the breadcrumb of the back-office page, written with " > " between
 * its parts.
 *
 * Example #1: Then the back office breadcrumb should be "Catalog > Products"
 * Example #2: Then the back office breadcrumb should be "Orders > Shopping Carts"
 * Example #3: Then the back office breadcrumb should be "Customers > Addresses"
 * Example #4: And the back office breadcrumb should be "Module Manager > Modules"
 * Example #5: Then the back office breadcrumb should be "Discounts > Cart Rules"
 *
 */
Then(/^the back office breadcrumb should be "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const wanted = String(expected).split('>').map((part) => part.trim()).join(' > ');
  // The icon of the first part is text too (<i class="material-icons">store</i>): read the parts without it.
  const read = () => page.locator('.breadcrumb').first().locator('li').evaluateAll((items) => items.map((item) => {
    const copy = item.cloneNode(true);
    copy.querySelectorAll('i').forEach((icon) => icon.remove());
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean).join(' > '));
  await waitUntil(this, read, (text) => text === wanted, (text) => ({
    message: `Expected the breadcrumb "${wanted}", but it is "${text || '(none)'}".`,
    hint: 'The breadcrumb is ol.breadcrumb on new pages and ul.breadcrumb.page-breadcrumb on legacy pages; some pages add parts (Categories adds the open category).',
  }));
});

/**
 * Press a button of the toolbar at the top right of a back-office page, by
 * its label: "Add new category", "Add new customer", "Add new cart rule",
 * "Edit category"… They are links with an icon, which the generic press step
 * (buttons only) does not find. ("Add new product" opens a dialog: use the
 * step that creates a product.)
 *
 * Example #1: When I press the back office toolbar button "Add new category"
 * Example #2: When I press the back office toolbar button "Add new cart rule"
 * Example #3: When we press the back office toolbar button "Add new customer"
 * Example #4: And I press the back office toolbar button "Add new address"
 * Example #5: When I press the back office toolbar button "Edit category"
 *
 */
When(/^(I |we )*press the back office toolbar button "([^"]*)"$/, async function (pronounCase, label) {
  const buttons = this.page.locator('a[id^="page-header-desc-"]:visible');
  const names = await buttons.evaluateAll((links) => links.map((link) => {
    const copy = link.cloneNode(true);
    copy.querySelectorAll('i').forEach((icon) => icon.remove());
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  }));
  const index = names.indexOf(label);
  if (index < 0) {
    throw friendly({ message: `The toolbar of the page has no button "${label}". It has: ${names.filter(Boolean).join(', ') || '(none)'}.`, hint: 'Toolbar buttons are the links a[id^="page-header-desc-"] at the top right of a back-office page.' });
  }
  await buttons.nth(index).click({ timeout: budget(this) });
  await settle(this);
});

// ---------------------------------------------------------------------------
// Addresses, the security token, access denied
// ---------------------------------------------------------------------------

/**
 * Open a back-office address by its path after the back-office folder, with
 * the security token of the session (read from the menu links). Use it for a
 * page the menu does not show, such as one the employee may not open.
 *
 * Example #1: When I open the back office path "improve/modules/manage"
 * Example #2: When I open the back office path "configure/advanced/employees/"
 * Example #3: When we open the back office path "sell/catalog/products/"
 * Example #4: And I open the back office path "index.php?controller=AdminDashboard"
 * Example #5: When I open the back office path "sell/orders/"
 *
 */
When(/^(I |we )*open the back office path "([^"]*)"$/, async function (pronounCase, path) {
  const url = await adminPathUrl(this, path);
  await go(this, url).catch((err) => {
    throw friendly({ action: 'open the back office path', target: path, cause: err, hint: 'The address did not load. A profile without the right to a page normally gets the access denied page (HTTP 403).' });
  });
  await settle(this);
});

/**
 * Open a back-office address without the security token, as a pasted or
 * bookmarked link would: the back office answers with its "Invalid token" page.
 *
 * Example #1: When I open the back office path "sell/catalog/products/" without the security token
 * Example #2: When I open the back office path "sell/orders/" without the security token
 * Example #3: When we open the back office path "improve/modules/manage" without the security token
 * Example #4: And I open the back office path "sell/customers/" without the security token
 * Example #5: When I open the back office path "configure/advanced/employees/" without the security token
 *
 */
When(/^(I |we )*open the back office path "([^"]*)" without the security token$/, async function (pronounCase, path) {
  await open(this, await adminPathUrl(this, path, false));
});

/**
 * Assert that the back office shows its "Invalid token" page, which asks
 * whether to display a page opened without the security token.
 *
 * Example #1: Then I should see the invalid security token page
 * Example #2: Then we should see the invalid security token page
 * Example #3: And I should see the invalid security token page
 * Example #4: Then I should not see the invalid security token page
 * Example #5: Then should see the invalid security token page
 *
 */
Then(/^(I |we )*should( not)* see the invalid security token page$/, async function (pronounCase, notCase) {
  const page = this.page;
  await waitUntil(this,
    async () => ({ url: page.url(), text: clean(await page.locator('body').innerText({ timeout: 2000 })).slice(0, 160) }),
    (now) => (/\/security\/compromised/.test(now.url) && /Invalid token/.test(now.text)) === !notCase,
    (now) => ({
      message: `Expected ${notCase ? 'not ' : ''}to see the "Invalid token" page, but the page is ${now ? now.url.split('?')[0] : 'unknown'}: "${now ? now.text : ''}".`,
      hint: 'The page lives at <back office>/security/compromised and offers "I understand the risk" and "Take me out of there!".',
    }));
});

/**
 * Assert that the back office refused the page to the employee: the access
 * denied page ("You do not have permission to do this", HTTP 403), or not.
 *
 * Example #1: Then I should see the access denied page
 * Example #2: Then I should not see the access denied page
 * Example #3: Then we should see the access denied page
 * Example #4: And I should see the access denied page
 * Example #5: Then should not see the access denied page
 *
 */
Then(/^(I |we )*should( not)* see the access denied page$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('p.error-header:visible').filter({ hasText: /You do not have permission/ }), notCase, {
    label: 'the access denied page ("You do not have permission to do this")',
    hint: 'The page keeps the menu and the title of the refused page and shows p.error-header with the buttons "Enable debug mode" and "Back to previous page".',
    timeout: budget(this),
    found: async () => `the page "${clean(await this.page.title())}" at ${this.page.url().split('?')[0]}`,
  });
});

// ---------------------------------------------------------------------------
// Messages, notifications, field errors
// ---------------------------------------------------------------------------

/**
 * Assert a message of the page by its type and text: the green, red, yellow or
 * blue box the back office and the shop show after an action. The text may be
 * a part of the message.
 *
 * Example #1: Then I should see the success message "Successful update"
 * Example #2: Then I should see the error message "The employee does not exist, or the password provided is incorrect."
 * Example #3: Then I should not see the error message "Authentication failed."
 * Example #4: Then we should see the success message "Successful creation"
 * Example #5: And I should see the info message "You have not placed any orders."
 *
 */
Then(/^(I |we )*should( not)* see the (success|error|warning|info) message "([^"]*)"$/, async function (pronounCase, notCase, type, text) {
  await assertPresence(messages(this, type, text), notCase, {
    label: `the ${type} message "${text}"`,
    hint: 'A message is a visible .alert.alert-success, -danger (error), -warning or -info. Texts differ by one word between screens ("Successful update", "Update successful"): copy the text from the page.',
    timeout: budget(this),
    found: () => messagesSeen(this),
  });
});

/**
 * Assert that the page shows no message of a type at all, for example no error
 * after saving.
 *
 * Example #1: Then I should not see any error message
 * Example #2: Then I should not see any warning message
 * Example #3: Then we should not see any error message
 * Example #4: And I should not see any error message
 * Example #5: Then should not see any success message
 *
 */
Then(/^(I |we )*should not see any (success|error|warning) message$/, async function (pronounCase, type) {
  await this.page.waitForLoadState('load').catch(() => {});
  const shown = messages(this, type);
  if (await shown.count()) {
    throw friendly({
      message: `Expected no ${type} message, but the page shows: ${await messagesSeen(this)}.`,
      hint: 'Read the message: it says what the page refused.',
    });
  }
});

/**
 * Assert the notification that slides in at the top right of the back office
 * after an action that does not reload the page (a row switch, a module).
 *
 * Example #1: Then I should see the notification "The status has been successfully updated."
 * Example #2: Then I should see the notification "Enable action on module ps_banner succeeded."
 * Example #3: Then we should see the notification "Disable action on module ps_banner succeeded."
 * Example #4: And I should see the notification "successfully updated"
 * Example #5: Then I should not see the notification "Error"
 *
 */
Then(/^(I |we )*should( not)* see the notification "([^"]*)"$/, async function (pronounCase, notCase, text) {
  await assertPresence(notifications(this, text), notCase, {
    label: `the notification "${text}"`,
    hint: 'Notifications are .growl elements inside #growls-default; they leave after a few seconds, so assert them right after the action.',
    timeout: budget(this),
    found: () => messagesSeen(this),
  });
});

/**
 * Assert the error a form shows under one of its fields, in the back office
 * (a red line under the field) or in the shop.
 *
 * Example #1: Then I should see the field error "The field name is required at least in your default language."
 * Example #2: Then I should see the field error "This value should be either positive or zero."
 * Example #3: Then we should see the field error "This voucher does not exist."
 * Example #4: And I should not see the field error "The field name is required"
 * Example #5: Then I should see the field error "is required"
 *
 */
Then(/^(I |we )*should( not)* see the field error "([^"]*)"$/, async function (pronounCase, notCase, text) {
  const errors = this.page.locator('.text-danger[role="alert"]:visible, .invalid-feedback:visible, .js-error:visible, .alert-danger:visible, .form-text.text-danger:visible').filter({ hasText: literal(text) });
  await assertPresence(errors, notCase, {
    label: `the field error "${text}"`,
    hint: 'Field errors are div.text-danger[role=alert] under the field in the back office and .invalid-feedback / .js-error in the shop. An empty required field of the shop is stopped by the browser itself, with no message in the page.',
    timeout: budget(this),
    found: async () => (await this.page.locator('.text-danger[role="alert"]:visible, .invalid-feedback:visible, .js-error:visible, .alert-danger:visible').allInnerTexts()).map((line) => `"${clean(line)}"`).join(', ') || 'no error',
  });
});

// ---------------------------------------------------------------------------
// Confirmation dialogs
// ---------------------------------------------------------------------------

/**
 * Assert that a confirmation dialog is open and that its title or its text
 * contains the given words.
 *
 * Example #1: Then I should see the confirmation dialog "Duplicate product"
 * Example #2: Then I should see the confirmation dialog "Permanently delete this product?"
 * Example #3: Then we should see the confirmation dialog "Delete selected item?"
 * Example #4: And I should see the confirmation dialog "What do you want to do with the products associated with this category?"
 * Example #5: Then I should see the confirmation dialog "How do you want to delete the selected customers?"
 *
 */
Then(/^(I |we )*should see the confirmation dialog "([^"]*)"$/, async function (pronounCase, text) {
  await waitUntil(this,
    () => dialogText(this),
    (shown) => shown.includes(text),
    (shown) => ({
      message: shown ? `Expected a confirmation dialog with "${text}", but the open dialog says "${shown.slice(0, 200)}".` : `Expected a confirmation dialog with "${text}", but no dialog is open.`,
      hint: DIALOG_HINT,
    }));
});

/**
 * Confirm the open dialog: press its confirming button ("Delete", "Duplicate",
 * "Yes"…), whatever its label.
 *
 * Example #1: When I confirm the dialog
 * Example #2: When we confirm the dialog
 * Example #3: And I confirm the dialog
 * Example #4: Then I confirm the dialog
 * Example #5: When confirm the dialog
 *
 */
When(/^(I |we )*confirm the dialog$/, async function (pronounCase) {
  await answerDialog(this, true);
});

/**
 * Cancel the open dialog: press its "Cancel" (or "No") button, so nothing is
 * changed.
 *
 * Example #1: When I cancel the dialog
 * Example #2: When we cancel the dialog
 * Example #3: And I cancel the dialog
 * Example #4: Then I cancel the dialog
 * Example #5: When cancel the dialog
 *
 */
When(/^(I |we )*cancel the dialog$/, async function (pronounCase) {
  await answerDialog(this, false);
});

/**
 * Assert that no confirmation dialog is open (any more).
 *
 * Example #1: Then I should not see a confirmation dialog
 * Example #2: Then we should not see a confirmation dialog
 * Example #3: And I should not see a confirmation dialog
 * Example #4: Then should not see a confirmation dialog
 * Example #5: But I should not see a confirmation dialog
 *
 */
Then(/^(I |we )*should not see a confirmation dialog$/, async function (pronounCase) {
  await assertPresence(dialog(this), true, {
    label: 'a confirmation dialog',
    hint: DIALOG_HINT,
    timeout: budget(this),
    found: async () => `"${(await dialogText(this)).slice(0, 160)}"`,
  });
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/**
 * Filter the list of the page by one of its columns: type the value in the
 * filter under the column title (or choose it, when the filter is a select)
 * and press "Search". The list remembers the filter for the employee until it
 * is reset.
 *
 * Example #1: When I filter the list by "Name" with "mug"
 * Example #2: When I filter the list by "Reference" with "demo_14"
 * Example #3: When we filter the list by "Email address" with "customer@example.com"
 * Example #4: And I filter the list by "Status" with "Awaiting check payment"
 * Example #5: When I filter the list by "Category" with "Art"
 *
 */
When(/^(I |we )*filter the list by "([^"]*)" with "([^"]*)"$/, async function (pronounCase, column, value) {
  const table = await grid(this);
  const index = await gridColumnIndex(table, column);
  const cell = table.locator('thead > tr.column-filters').locator('> td, > th').nth(index);
  const control = cell.locator('input:not([type="hidden"]):visible, select:visible').first();
  await actOrExplain('filter the list by', column, async () => {
    await control.waitFor({ state: 'visible', timeout: budget(this) });
    if ((await control.evaluate((node) => node.tagName)) === 'SELECT') await control.selectOption({ label: value });
    else await control.fill(value);
    await table.locator('thead .grid-search-button').click();
  }, 'Filters sit in the row under the column titles (tr.column-filters) of a new-style list; a column without a filter (Image, Actions) cannot be filtered. ' + GRID_HINT);
  await settle(this);
});

/**
 * Reset the filters of the list ("Reset"), so it shows every record again.
 * Does nothing when the list is not filtered.
 *
 * Example #1: When I reset the list filters
 * Example #2: When we reset the list filters
 * Example #3: And I reset the list filters
 * Example #4: Given I reset the list filters
 * Example #5: Then I reset the list filters
 *
 */
When(/^(I |we )*reset the list filters$/, async function (pronounCase) {
  const page = this.page;
  await grid(this).catch(() => null);
  const reset = page.locator('.js-reset-search:visible').first();
  if (!(await reset.count())) return;
  await reset.click({ timeout: budget(this) });
  // "Reset" posts in the background and then loads the list again: wait for the button to go.
  await page.locator('.js-reset-search:visible').first().waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
  await settle(this);
});

/**
 * Assert how many records the list shows on this page.
 *
 * Example #1: Then the list should have 5 rows
 * Example #2: Then the list should have 1 row
 * Example #3: Then the list should have 0 rows
 * Example #4: And the list should have 19 rows
 * Example #5: Then the list should have 10 rows
 *
 */
Then(/^the list should have (\d+) rows?$/, async function (count) {
  const table = await grid(this);
  const wanted = Number(count);
  await waitUntil(this,
    () => gridRows(table).count(),
    (rows) => rows === wanted,
    (rows) => ({
      message: `Expected the list to have ${wanted} row${wanted === 1 ? '' : 's'}, but it has ${rows}.`,
      hint: 'The count is of this page of the list. A list keeps its filters and its page size for the employee: reset the filters first.',
    }));
});

/**
 * Assert that the list shows, or does not show, a row containing the text.
 *
 * Example #1: Then I should see "Customizable mug" in the list
 * Example #2: Then I should not see "Webship test mug" in the list
 * Example #3: Then we should see "customer@example.com" in the list
 * Example #4: And I should not see "Webship test category" in the list
 * Example #5: Then I should see "WEBSHIP10" in the list
 *
 */
Then(/^(I |we )*should( not)* see "([^"]*)" in the list$/, async function (pronounCase, notCase, text) {
  const table = await grid(this);
  await assertPresence(gridRows(table).filter({ hasText: literal(text) }), notCase, {
    label: `a row with "${text}" in the list`,
    hint: 'Only the rows of this page are read. Reset the filters, or filter the list by a column first.',
    timeout: budget(this),
    found: async () => (await gridRows(table).evaluateAll((rows) => rows.slice(0, 6).map((row) => row.innerText.replace(/\s+/g, ' ').trim().slice(0, 60)))).join(' | ') || 'an empty list',
  });
});

/**
 * Assert that the first row of the list contains the text: what is on top
 * after a sort, or the newest order.
 *
 * Example #1: Then the first row of the list should contain "Customizable mug"
 * Example #2: Then the first row of the list should contain "Awaiting check payment"
 * Example #3: And the first row of the list should contain "C. Customer"
 * Example #4: Then the first row of the list should contain "Bank transfer"
 * Example #5: Then the first row of the list should contain "demo_14"
 *
 */
Then(/^the first row of the list should contain "([^"]*)"$/, async function (text) {
  const table = await grid(this);
  await waitUntil(this,
    async () => clean(await gridRows(table).first().innerText({ timeout: 2000 })),
    (row) => row.includes(text),
    (row) => ({
      message: `Expected the first row of the list to contain "${text}", but it reads "${(row || '(no row)').slice(0, 200)}".`,
      hint: 'The orders list shows the newest order first and writes the customer as an initial and a last name ("C. Customer").',
    }));
});

/**
 * Assert the content of one cell: the value in a column for the row that
 * shows the given text.
 *
 * Example #1: Then the "Quantity" of the list row "Customizable mug" should be "300"
 * Example #2: Then the "Category" of the list row "Customizable mug" should be "Home Accessories"
 * Example #3: Then the "Payment" of the list row "KHWLILZLL" should be "Bank wire"
 * Example #4: And the "Code" of the list row "Webship ten percent" should be "WEBSHIP10"
 * Example #5: Then the "Group" of the list row "customer@example.com" should be "Customer"
 *
 */
Then(/^the "([^"]*)" of the list row "([^"]*)" should be "([^"]*)"$/, async function (column, rowText, expected) {
  const table = await grid(this);
  const index = await gridColumnIndex(table, column);
  const row = await gridRow(this, rowText);
  await waitUntil(this,
    async () => clean(await row.locator('> td').nth(index).innerText({ timeout: 2000 })),
    (value) => value === expected,
    (value) => ({
      message: `Expected the "${column}" of the row "${rowText}" to be "${expected}", but it is "${value}".`,
      hint: 'Prices are written as the list shows them ("$13.90"), customers of an order as "J. DOE".',
    }));
});

/**
 * Open a record from the list by the main action of its row: the icon that is
 * always visible in the last column (Edit for products and customers, View
 * for orders, carts and categories).
 *
 * Example #1: When I open the list row "Customizable mug"
 * Example #2: When I open the list row "KHWLILZLL"
 * Example #3: When we open the list row "customer@example.com"
 * Example #4: And I open the list row "Webship test category"
 * Example #5: When I open the list row "Webship ten percent"
 *
 */
When(/^(I |we )*open the list row "([^"]*)"$/, async function (pronounCase, rowText) {
  const row = await gridRow(this, rowText);
  await actOrExplain('open the list row', rowText, async () => {
    // New lists: the edit or view link of the row (a paid order also has an invoice icon, which is a download). Legacy lists: "Edit".
    const main = row.locator('td.column-actions a.grid-edit-row-link:visible, td.column-actions a.grid-view-row-link:visible');
    const link = (await main.count()) ? main.first() : row.locator('td:last-child a.edit:visible, td:last-child a.btn:visible').first();
    await link.click({ timeout: budget(this) });
  }, GRID_HINT);
  await settle(this);
});

/**
 * Choose an action of a list row by its name: the visible icon ("Edit",
 * "View") or an entry of the menu behind the dots ("Preview", "Duplicate",
 * "Delete"), which the step opens. Destructive actions then ask for a
 * confirmation in a dialog.
 *
 * Example #1: When I choose "Duplicate" for the list row "Customizable mug"
 * Example #2: When I choose "Delete" for the list row "Webship test mug"
 * Example #3: When we choose "View" for the list row "customer@example.com"
 * Example #4: And I choose "Edit" for the list row "Webship test category"
 * Example #5: When I choose "Delete" for the list row "Webship ten percent"
 *
 */
When(/^(I |we )*choose "([^"]*)" for the list row "([^"]*)"$/, async function (pronounCase, action, rowText) {
  const row = await gridRow(this, rowText);
  const control = await gridRowAction(this, row, action);
  await actOrExplain(`choose "${action}" for the list row`, rowText, () => control.click({ timeout: budget(this) }), GRID_HINT);
  await settle(this);
});

/**
 * Tick the checkbox of a list row, to act on it with a bulk action.
 *
 * Example #1: When I select the list row "Webship bulk mug"
 * Example #2: When we select the list row "Webship test category"
 * Example #3: And I select the list row "Customizable mug"
 * Example #4: When I select the list row "demo_14"
 * Example #5: When select the list row "Webship bulk mug"
 *
 */
When(/^(I |we )*select the list row "([^"]*)"$/, async function (pronounCase, rowText) {
  const row = await gridRow(this, rowText);
  await actOrExplain('select the list row', rowText, async () => {
    // The checkbox is drawn by an <i> over the input: tick through the label, as a click does.
    const box = row.locator('input.js-bulk-action-checkbox, td:first-child input[type="checkbox"]').first();
    await box.check({ force: true, timeout: budget(this) });
  }, 'The first cell of a row holds its checkbox (input.js-bulk-action-checkbox).');
});

/**
 * Choose a bulk action for the selected rows from the "Bulk actions" menu,
 * which is disabled until a row is selected. The action then asks for a
 * confirmation in a dialog.
 *
 * Example #1: When I choose the bulk action "Delete selection"
 * Example #2: When I choose the bulk action "Deactivate selection"
 * Example #3: When we choose the bulk action "Activate selection"
 * Example #4: And I choose the bulk action "Duplicate selection"
 * Example #5: When choose the bulk action "Delete selection"
 *
 */
When(/^(I |we )*choose the bulk action "([^"]*)"$/, async function (pronounCase, action) {
  const page = this.page;
  const button = page.locator('.js-bulk-actions-btn:visible').first();
  if (await button.isDisabled().catch(() => true)) {
    throw friendly({ message: `Could not choose the bulk action "${action}": the "Bulk actions" button is disabled or missing.`, hint: 'Select a row of the list first; the button stays disabled until a checkbox is ticked.' });
  }
  await button.click();
  const menu = button.locator('xpath=..').locator('.dropdown-menu');
  const names = await menu.locator('button, a').evaluateAll((items) => items.map((item) => [...item.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim()));
  const index = names.indexOf(action);
  if (index < 0) {
    throw friendly({ message: `The "Bulk actions" menu has no action "${action}". It has: ${names.filter(Boolean).join(', ')}.`, hint: 'Write the action as the menu shows it.' });
  }
  await menu.locator('button, a').nth(index).click({ timeout: budget(this) });
});

/**
 * Wait for a bulk action of the products list to finish: its progress dialog
 * reaches 100 % and stays open until "Close" is pressed, which reloads the
 * list. Fails when the progress dialog reports an error.
 *
 * Example #1: When I wait for the bulk action to finish
 * Example #2: When we wait for the bulk action to finish
 * Example #3: And I wait for the bulk action to finish
 * Example #4: Then I wait for the bulk action to finish
 * Example #5: When wait for the bulk action to finish
 *
 */
When(/^(I |we )*wait for the bulk action to finish$/, async function (pronounCase) {
  const page = this.page;
  const progress = page.locator('.modal.show:visible').filter({ has: page.locator('.close-modal-button') }).first();
  try {
    await progress.waitFor({ state: 'visible', timeout: budget(this) });
    await page.waitForFunction(() => {
      const box = [...document.querySelectorAll('.modal.show')].find((node) => node.querySelector('.close-modal-button'));
      return box && /100\s*%/.test(box.innerText);
    }, null, { timeout: 30000 });
  } catch {
    throw friendly({
      message: `Expected the progress dialog of a bulk action to reach 100 %, but ${(await dialogText(this)) ? `the open dialog says "${(await dialogText(this)).slice(0, 200)}"` : 'no progress dialog is open'}.`,
      hint: 'Choose a bulk action and confirm its dialog first. The progress dialog reads "Activating 1 / 1 products 100%" and has the button "Close" (.close-modal-button).',
    });
  }
  const text = await dialogText(this);
  await progress.locator('.close-modal-button').click();
  await settle(this);
  if (/error|failed/i.test(text)) {
    throw friendly({ message: `The bulk action reported a problem: "${text.slice(0, 300)}".`, hint: 'Open the list in a browser and run the bulk action by hand to read the details.' });
  }
});

/**
 * Flip the switch a list row shows in a column (the "Status" of a product, the
 * "Displayed" of a category, the "Enabled" of a customer). The list saves it
 * in the background and confirms with a notification.
 *
 * Example #1: When I flip the "Status" switch of the list row "Webship bulk mug"
 * Example #2: When I flip the "Displayed" switch of the list row "Webship test category"
 * Example #3: When we flip the "Status" switch of the list row "Customizable mug"
 * Example #4: And I flip the "Enabled" switch of the list row "shopper@example.com"
 * Example #5: When flip the "Status" switch of the list row "Webship bulk mug"
 *
 */
When(/^(I |we )*flip the "([^"]*)" switch of the list row "([^"]*)"$/, async function (pronounCase, column, rowText) {
  const table = await grid(this);
  const index = await gridColumnIndex(table, column);
  const row = await gridRow(this, rowText);
  const toggle = row.locator('> td').nth(index).locator('.ps-switch');
  await actOrExplain(`flip the "${column}" switch of the list row`, rowText, async () => {
    const before = await toggle.locator('input[value="1"]').isChecked();
    await toggle.click({ timeout: budget(this) });
    await this.page.waitForFunction(([node, was]) => node.querySelector('input[value="1"]').checked !== was, [await toggle.elementHandle(), before], { timeout: budget(this) });
  }, 'A switch is a .ps-switch in the cell of the column (two radios, the one with value 1 means on). A column of plain text has none.');
});

/**
 * Assert whether the switch a list row shows in a column is on or off.
 *
 * Example #1: Then the "Status" switch of the list row "Webship bulk mug" should be on
 * Example #2: Then the "Status" switch of the list row "Webship bulk mug" should be off
 * Example #3: Then the "Displayed" switch of the list row "Webship test category" should be on
 * Example #4: And the "Status" switch of the list row "Customizable mug" should be on
 * Example #5: Then the "Enabled" switch of the list row "shopper@example.com" should be on
 *
 */
Then(/^the "([^"]*)" switch of the list row "([^"]*)" should be (on|off)$/, async function (column, rowText, state) {
  const table = await grid(this);
  const index = await gridColumnIndex(table, column);
  const row = await gridRow(this, rowText);
  const on = row.locator('> td').nth(index).locator('.ps-switch input[value="1"]');
  await waitUntil(this,
    () => on.isChecked({ timeout: 2000 }),
    (checked) => checked === (state === 'on'),
    (checked) => ({
      message: `Expected the "${column}" switch of the row "${rowText}" to be ${state}, but it is ${checked === undefined ? 'not there' : checked ? 'on' : 'off'}.`,
      hint: 'A switch is a .ps-switch in the cell of the column; its radio with value 1 is checked when it is on.',
    }));
});

/**
 * Sort the list by a column, in ascending or descending order, with the sort
 * control of its title. The list remembers the order for the employee, as it
 * remembers its filters: put the usual order back at the end of a scenario.
 *
 * Example #1: When I sort the list by "Name" in ascending order
 * Example #2: When I sort the list by "ID" in descending order
 * Example #3: When we sort the list by "Quantity" in descending order
 * Example #4: And I sort the list by "Reference" in ascending order
 * Example #5: When sort the list by "Name" in descending order
 *
 */
When(/^(I |we )*sort the list by "([^"]*)" in (ascending|descending) order$/, async function (pronounCase, column, order) {
  const wanted = order === 'ascending' ? 'asc' : 'desc';
  const table = await grid(this);
  const index = await gridColumnIndex(table, column);
  const header = () => table.locator('thead > tr').first().locator('th').nth(index).locator('[data-sort-col-name]');
  await actOrExplain('sort the list by', column, async () => {
    // A first press sorts ascending, the next one reverses: press until the title says what is wanted.
    for (let press = 0; press < 3; press += 1) {
      const state = await header().evaluate((node) => (node.getAttribute('data-sort-is-current') === 'true' ? node.getAttribute('data-sort-direction') : ''), null, { timeout: budget(this) });
      if (state === wanted) return;
      await header().click({ timeout: budget(this) });
      await settle(this);
    }
    throw new Error(`The column did not reach the ${order} order after three presses.`);
  }, 'Only the columns whose title has a sort control ([data-sort-col-name], with data-sort-direction) can be sorted (not Image or Actions).');
});

/**
 * Choose how many records the list shows per page ("Items per page").
 *
 * Example #1: When I show 10 rows per page in the list
 * Example #2: When I show 20 rows per page in the list
 * Example #3: When we show 50 rows per page in the list
 * Example #4: And I show 10 rows per page in the list
 * Example #5: When show 100 rows per page in the list
 *
 */
When(/^(I |we )*show (\d+) rows per page in the list$/, async function (pronounCase, size) {
  const select = this.page.locator('select#paginator_select_page_limit:visible, select[name="paginator_select_page_limit"]:visible').first();
  await actOrExplain('show rows per page:', size, async () => {
    await select.waitFor({ state: 'visible', timeout: budget(this) });
    await Promise.all([this.page.waitForLoadState('load'), select.selectOption(String(size))]);
  }, 'The page size is the select "Items per page" (10, 20, 50, 100, 300, 1000) under a new-style list. A list whose records fit the smallest page (10 or fewer) shows no pagination at all.');
  await settle(this);
});

/**
 * Go to the next or to the previous page of the list.
 *
 * Example #1: When I go to the next page of the list
 * Example #2: When I go to the previous page of the list
 * Example #3: When we go to the next page of the list
 * Example #4: And I go to the previous page of the list
 * Example #5: When go to the next page of the list
 *
 */
When(/^(I |we )*go to the (next|previous) page of the list$/, async function (pronounCase, direction) {
  const link = this.page.locator(`.pagination-block a[data-role="${direction}-page-link"]:visible`).first();
  const disabled = await link.evaluate((node) => node.closest('li').classList.contains('disabled'), null, { timeout: budget(this) }).catch(() => true);
  if (disabled) {
    const reading = clean(await this.page.locator('.pagination-block label.col-form-label').first().innerText({ timeout: 1000 }).catch(() => ''));
    throw friendly({ message: `Could not go to the ${direction} page of the list: there is none. ${reading ? 'The list reads "' + reading + '".' : 'The list shows no pagination.'}`, hint: 'A list whose records fit the smallest page shows no pagination; choose a smaller page size first.' });
  }
  await link.click();
  await settle(this);
});

/**
 * Assert what the pagination of the list reads, for example
 * "Viewing 1-10 out of 19 (page 1 / 2)". The text may be a part of it.
 *
 * Example #1: Then the list pagination should read "Viewing 1-10 out of 19 (page 1 / 2)"
 * Example #2: Then the list pagination should read "Viewing 11-19 out of 19 (page 2 / 2)"
 * Example #3: Then the list pagination should read "out of 19"
 * Example #4: And the list pagination should read "page 2 / 2"
 * Example #5: Then the list pagination should read "Viewing 1-19 out of 19 (page 1 / 1)"
 *
 */
Then(/^the list pagination should read "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await waitUntil(this,
    async () => clean(await page.locator('.pagination-block label.col-form-label').first().innerText({ timeout: 2000 })),
    (text) => text.includes(expected),
    (text) => ({
      message: `Expected the pagination of the list to read "${expected}", but ${text ? `it reads "${text}"` : 'the list shows no pagination'}.`,
      hint: 'The pagination block is absent when the records fit the smallest page (10 or fewer). The reading is "Viewing 1-10 out of 19 (page 1 / 2)".',
    }));
});

// ---------------------------------------------------------------------------
// Form fields by their visible label
// ---------------------------------------------------------------------------

/**
 * Fill in a field of a back-office form, found by the label a person reads
 * next to it. Many back-office fields have no usable accessible name (the
 * name of a category announces itself as "category_name_1 input"), so the
 * generic fill step cannot find them by label.
 *
 * Example #1: When I fill in the back office field "Name" with "Webship test category"
 * Example #2: When I fill in the back office field "Code" with "WEBSHIP10"
 * Example #3: When we fill in the back office field "Value" with "10"
 * Example #4: And I fill in the back office field "Friendly URL" with "webship-test-category"
 * Example #5: When I fill in the back office field "Name" with ""
 *
 */
When(/^(I |we )*fill in the back office field "([^"]*)" with "([^"]*)"$/, async function (pronounCase, label, value) {
  const control = await fieldControl(this, label);
  await actOrExplain('fill in the back office field', label, async () => {
    await control.fill(value, { timeout: budget(this) });
    // Fields react to "change" (the friendly URL follows the name, Save turns on): leave the field.
    await control.blur();
  }, FIELD_HINT);
});

/**
 * Assert the value of a field of a back-office form, found by its label.
 *
 * Example #1: Then the back office field "Name" should contain "Webship test category"
 * Example #2: Then the back office field "Friendly URL" should contain "webship-test-category"
 * Example #3: Then the back office field "Code" should contain "WEBSHIP10"
 * Example #4: And the back office field "Value" should contain "10"
 * Example #5: Then the back office field "Name" should contain ""
 *
 */
Then(/^the back office field "([^"]*)" should contain "([^"]*)"$/, async function (label, expected) {
  const control = await fieldControl(this, label);
  await waitUntil(this,
    () => control.inputValue({ timeout: 2000 }),
    (value) => value === expected,
    (value) => ({ message: `Expected the field "${label}" to contain "${expected}", but it contains "${value}".`, hint: FIELD_HINT }));
});

/**
 * Choose an option of a back-office field made of radio buttons or of a
 * select, found by the label of the field and the label of the option.
 *
 * Example #1: When I choose "Percent (%)" for the back office field "Apply a discount"
 * Example #2: When I choose "No" for the back office field "Enabled"
 * Example #3: When we choose "Yes" for the back office field "Free shipping"
 * Example #4: And I choose "Yes" for the back office field "Enabled"
 * Example #5: When I choose "Amount" for the back office field "Apply a discount"
 *
 */
When(/^(I |we )*choose "([^"]*)" for the back office field "([^"]*)"$/, async function (pronounCase, option, label) {
  const group = await fieldGroup(this, label);
  await actOrExplain(`choose "${option}" for the back office field`, label, async () => {
    const select = group.locator('select:visible').first();
    if (await select.count()) {
      await select.selectOption({ label: option });
      return;
    }
    const choice = group.locator('label').filter({ hasText: new RegExp('^\\s*' + option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first();
    await choice.click({ timeout: budget(this) });
  }, FIELD_HINT + ' The options of a radio field are the labels next to its buttons.');
});

/**
 * Open a tab of a back-office form by its title (the tabs of the product page,
 * or "Information", "Conditions", "Actions" of a cart rule).
 *
 * Example #1: When I open the back office form tab "Actions"
 * Example #2: When I open the back office form tab "Pricing"
 * Example #3: When we open the back office form tab "Stocks"
 * Example #4: And I open the back office form tab "Conditions"
 * Example #5: When I open the back office form tab "Details"
 *
 */
When(/^(I |we )*open the back office form tab "([^"]*)"$/, async function (pronounCase, title) {
  const tab = this.page.locator('a[role="tab"]:visible, .nav-tabs a:visible, a[id*="_link_"]:visible').filter({ hasText: new RegExp('^\\s*' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first();
  await actOrExplain('open the back office form tab', title, () => tab.click({ timeout: budget(this) }), 'Tabs are a[role=tab] inside #form-nav on the product page and the links #cart_rule_link_… on the cart rule form.');
});

/**
 * Save the back-office form of the page with its "Save" button and wait for
 * the answer of the back office: a message, a field error, or the list the
 * form returns to.
 *
 * Example #1: When I save the back office form
 * Example #2: When we save the back office form
 * Example #3: And I save the back office form
 * Example #4: Then I save the back office form
 * Example #5: When save the back office form
 *
 */
When(/^(I |we )*save the back office form$/, async function (pronounCase) {
  const page = this.page;
  // New forms: button#save-button. Legacy forms: a link a#desc-<name>-save, twice in the page (one copy hidden).
  const save = page.locator('button#save-button:visible, a[id^="desc-"][id$="-save"]:visible, #product_footer_save:visible').first();
  await actOrExplain('save', 'the back office form', async () => {
    await save.waitFor({ state: 'visible', timeout: budget(this) });
    if (await save.isDisabled().catch(() => false)) {
      throw new Error('The "Save" button is disabled: nothing was changed, or the last field was not left (the button turns on when a field fires "change").');
    }
    await save.click();
  }, 'The "Save" button is button#save-button on new forms, a#desc-…-save on legacy forms and #product_footer_save on the product page.');
  await settle(this);
  await page.locator('.alert-success:visible, .alert-danger:visible, .text-danger[role="alert"]:visible').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
});
