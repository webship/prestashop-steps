'use strict';

// Shop (front office) step definitions: the customer session, the page type,
// the main menu and the breadcrumb, the product list (count, sort, filters,
// pagination), the search, the product page (options, quantity, add to cart,
// the cart dialog), the cart (quantity, remove, voucher), the checkout (as a
// guest and as a customer, with the offline payment methods), the order
// confirmation, the customer account (order history, addresses).
//
// The back office has its own files: prestashop-back-office.steps.js and
// prestashop-catalog.steps.js. The messages ("I should see the success message
// …") and the field errors are shared and live in the back-office file.
//
// Customers are configuration: `worldParameters.customers` in cucumber.js lists
// them and the site build script creates them.
//
// The steps read what the shop itself says (the `prestashop` object: who is
// signed in, the kind of page, the cart count), then roles and labels, then the
// hooks of the default theme of 9.x, Hummingbird (#js-product-list,
// .js-product-miniature, .js-cart-item, #checkout-…-step, data-link-action).
// They were written and run on that theme; a shop on another theme may need
// its own steps for the parts the theme draws.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  literal,
  exactly,
  clean,
  siteRoot,
  open,
  settle,
  actOrExplain,
  assertPresence,
  waitUntil,
  memory,
  resolveAccount,
  messagesSeen,
  SHOP_HINT,
  shopState,
  shopPage,
  sendCustomerSignIn,
  CARD_TITLE,
  listedProducts,
  cartLines,
  checkoutStep,
} = require('./prestashop-helpers');

// ---------------------------------------------------------------------------
// The customer session
// ---------------------------------------------------------------------------

/**
 * Sign in to the shop as a customer of the registry
 * (`worldParameters.customers` in cucumber.js), by its handle.
 *
 * Example #1: Given I am signed in to the shop as "customer"
 * Example #2: Given we are signed in to the shop as "customer"
 * Example #3: Given I am signed in to the shop as "shopper"
 * Example #4: And I am signed in to the shop as "customer"
 * Example #5: Given signed in to the shop as "shopper"
 *
 */
Given(/^(I am |we are )?signed in to the shop as "([^"]*)"$/, async function (pronounCase, handle) {
  const account = resolveAccount(this, 'customers', handle);
  await sendCustomerSignIn(this, account.email, account.password);
  const state = await shopState(this);
  if (!state.logged) {
    throw friendly({
      message: `Could not sign in to the shop as "${handle}" (${account.email}). The page says: ${await messagesSeen(this)}.`,
      hint: 'The customer must exist with that password: the site build script creates the accounts of worldParameters.customers.',
    });
  }
});

/**
 * Send the sign-in form of the shop with an e-mail address and a password,
 * without expecting it to succeed: for the refused sign-in.
 *
 * Example #1: When I sign in to the shop with "customer@example.com" and "wrong-password"
 * Example #2: When we sign in to the shop with "nobody@example.com" and "Whatever123456789!"
 * Example #3: And I sign in to the shop with "customer@example.com" and "x"
 * Example #4: When I sign in to the shop with "shopper@example.com" and "nope"
 * Example #5: When sign in to the shop with "customer@example.com" and "wrong-password"
 *
 */
When(/^(I |we )*sign in to the shop with "([^"]*)" and "([^"]*)"$/, async function (pronounCase, email, password) {
  await sendCustomerSignIn(this, email, password);
});

/**
 * Sign out of the shop through the customer menu of the header ("Sign out").
 *
 * Example #1: When I sign out of the shop
 * Example #2: When we sign out of the shop
 * Example #3: And I sign out of the shop
 * Example #4: Then I sign out of the shop
 * Example #5: When sign out of the shop
 *
 */
When(/^(I |we )*sign out of the shop$/, async function (pronounCase) {
  const page = this.page;
  await actOrExplain('sign out of', 'the shop', async () => {
    const menu = page.locator('#userMenuButton:visible').first();
    if (await menu.count()) await menu.click({ timeout: budget(this) });
    await page.locator('a[href*="mylogout"]:visible').first().click({ timeout: budget(this) });
  }, 'A signed-in customer has the header button "View my account (<name>)" whose menu ends with "Sign out" (a link to ?mylogout). Nobody is signed in when it is missing.');
  await settle(this);
});

/**
 * Assert that a customer is signed in to the shop, optionally by the name
 * the header shows, or that nobody is. The shop itself is asked
 * (`prestashop.customer.is_logged`).
 *
 * Example #1: Then I should be signed in to the shop
 * Example #2: Then I should be signed in to the shop as "Clara Customer"
 * Example #3: Then I should not be signed in to the shop
 * Example #4: And we should be signed in to the shop as "Simon Shopper"
 * Example #5: Then we should not be signed in to the shop
 *
 */
Then(/^(I |we )*should( not)* be signed in to the shop(?: as "([^"]*)")?$/, async function (pronounCase, notCase, name) {
  const page = this.page;
  const read = async () => {
    const state = await shopState(this);
    const label = await page.locator('#userMenuButton').first().getAttribute('aria-label', { timeout: 500 }).catch(() => '');
    return { logged: state.logged, email: state.email, label: label || '' };
  };
  await waitUntil(this, read,
    (now) => (notCase ? !now.logged : now.logged && (!name || now.label.includes(name))),
    (now) => ({
      message: notCase
        ? `Expected nobody to be signed in to the shop, but ${now ? now.email : 'a customer'} is signed in.`
        : `Expected ${name ? `"${name}"` : 'a customer'} to be signed in to the shop, but ${now && now.logged ? `the header says "${now.label}"` : 'nobody is signed in'}.`,
      hint: 'The header shows "Sign in" to a visitor and the button "View my account (<first name> <last name>)" to a customer.',
    }));
});

// ---------------------------------------------------------------------------
// Pages, menu, breadcrumb
// ---------------------------------------------------------------------------

/**
 * Open a page of the shop by its kind: the address is built from the
 * controller name, which is the same in every language of the shop.
 *
 * Example #1: Given I am on the shop "cart" page
 * Example #2: Given I am on the shop "contact" page
 * Example #3: When I go to the shop "registration" page
 * Example #4: When we go to the shop "order history" page
 * Example #5: Given I am on the shop "addresses" page
 *
 */
Given(/^(?:I am on|we are on|I go to|we go to) the shop "(home|sign in|registration|cart|checkout|my account|order history|addresses|new address|contact|identity)" page$/, async function (kind) {
  const controllers = {
    'home': null, 'sign in': 'authentication', 'registration': 'registration', 'cart': 'cart&action=show', 'checkout': 'order',
    'my account': 'my-account', 'order history': 'history', 'addresses': 'addresses', 'new address': 'address', 'contact': 'contact', 'identity': 'identity',
  };
  await open(this, controllers[kind] ? shopPage(this, controllers[kind]) : siteRoot(this) + '/');
});

/**
 * Assert the kind of shop page that is shown, as the shop names it (the id of
 * the body): index, category, product, search, cart, checkout,
 * order-confirmation, authentication, registration, my-account, history,
 * order-detail, addresses, address, contact, pagenotfound…
 *
 * Example #1: Then I should be on a "category" shop page
 * Example #2: Then I should be on a "product" shop page
 * Example #3: Then we should be on a "order-confirmation" shop page
 * Example #4: And I should be on a "pagenotfound" shop page
 * Example #5: Then I should be on a "authentication" shop page
 *
 */
Then(/^(I |we )*should be on an? "([^"]*)" shop page$/, async function (pronounCase, kind) {
  await waitUntil(this,
    () => shopState(this),
    (state) => state.page === kind,
    (state) => ({
      message: `Expected a "${kind}" shop page, but the page is a "${state ? state.page : 'unknown'}" page (${this.page.url().split('?')[0]}).`,
      hint: 'The kind of a shop page is the id of its <body> (prestashop.page.page_name).',
    }));
});

/**
 * Open a category from the main menu of the shop: a top entry ("Clothes") or
 * an entry of its submenu ("Clothes > Men"), which opens on hover.
 *
 * Example #1: When I open "Clothes" in the shop menu
 * Example #2: When I open "Clothes > Men" in the shop menu
 * Example #3: When we open "Accessories > Stationery" in the shop menu
 * Example #4: And I open "Art" in the shop menu
 * Example #5: When I open "Accessories" in the shop menu
 *
 */
When(/^(I |we )*open "([^"]*)" in the shop menu$/, async function (pronounCase, path) {
  const page = this.page;
  const [parent, child] = String(path).split('>').map((part) => part.trim());
  const menu = page.locator('nav[aria-label="Main navigation"]:visible').first();
  await actOrExplain('open in the shop menu:', path, async () => {
    const top = menu.locator('a').filter({ hasText: exactly(parent) }).first();
    await top.waitFor({ state: 'visible', timeout: budget(this) });
    if (!child) {
      await top.click();
      return;
    }
    await top.hover();
    const sub = menu.locator('a:visible').filter({ hasText: exactly(child) }).first();
    await sub.click({ timeout: budget(this) });
  }, 'The main menu is nav[aria-label="Main navigation"]; its top entries are the root categories and their children show in a panel on hover. On a narrow window the menu is behind the menu button.');
  await settle(this);
});

/**
 * Assert the breadcrumb of the shop page, written with " > " between its
 * parts.
 *
 * Example #1: Then the shop breadcrumb should be "Home > Accessories"
 * Example #2: Then the shop breadcrumb should be "Home > Clothes > Men"
 * Example #3: Then the shop breadcrumb should be "Home > Your account > Addresses"
 * Example #4: And the shop breadcrumb should be "Home > Cart"
 * Example #5: Then the shop breadcrumb should be "Home > Clothes > Men > Hummingbird printed t-shirt"
 *
 */
Then(/^the shop breadcrumb should be "([^"]*)"$/, async function (expected) {
  const wanted = String(expected).split('>').map((part) => part.trim()).join(' > ');
  const read = () => this.page.locator('nav[aria-label="breadcrumb" i] li').evaluateAll((items) => items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' > '));
  await waitUntil(this, read, (text) => text === wanted, (text) => ({
    message: `Expected the breadcrumb "${wanted}", but it is "${text || '(none)'}".`,
    hint: 'The breadcrumb is nav[aria-label="breadcrumb"]; the home page has none.',
  }));
});

// ---------------------------------------------------------------------------
// Product list: count, sort, filters, pagination
// ---------------------------------------------------------------------------

const LIST_HINT = 'The product list of a category or search page is #js-product-list (cards .js-product-miniature); sort, filters and pagination replace it in place and change the address (?order=, ?q=, ?page=).';

/** Wait until the product list was replaced after a sort, a filter or a page change. */
async function listChanged(world, before, expectUrl) {
  const page = world.page;
  await page.waitForFunction((pattern) => new RegExp(pattern).test(location.href), expectUrl, { timeout: budget(world) }).catch(() => {});
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const now = (await listedProducts(world)).join('|');
    if (now && now !== before) break;
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

/**
 * Assert how many products the product list shows on this page.
 *
 * Example #1: Then the product list should show 11 products
 * Example #2: Then the product list should show 3 products
 * Example #3: Then the product list should show 1 product
 * Example #4: And the product list should show 12 products
 * Example #5: Then the product list should show 7 products
 *
 */
Then(/^the product list should show (\d+) products?$/, async function (count) {
  await waitUntil(this,
    async () => (await listedProducts(this)).length,
    (shown) => shown === Number(count),
    (shown) => ({ message: `Expected the product list to show ${count} product(s), but it shows ${shown}.`, hint: LIST_HINT + ' A page shows 12 products at most.' }));
});

/**
 * Assert the sentence above the product list that counts the products found,
 * for example "There are 11 products." The text may be a part of it.
 *
 * Example #1: Then the product list should announce "There are 11 products."
 * Example #2: Then the product list should announce "There are 3 products."
 * Example #3: Then the product list should announce "There is 1 product."
 * Example #4: And the product list should announce "There are 19 products."
 * Example #5: Then the product list should announce "5 products"
 *
 */
Then(/^the product list should announce "([^"]*)"$/, async function (text) {
  await waitUntil(this,
    async () => clean(await this.page.locator('#js-product-list-top').first().innerText({ timeout: 2000 })),
    (shown) => shown.includes(text),
    (shown) => ({ message: `Expected the product list to announce "${text}", but it says "${(shown || '').slice(0, 120)}".`, hint: LIST_HINT }));
});

/**
 * Assert that the product list shows, or does not show, a product by its
 * name.
 *
 * Example #1: Then I should see the product "Customizable mug" in the product list
 * Example #2: Then I should not see the product "Hummingbird printed t-shirt" in the product list
 * Example #3: Then we should see the product "Mug The adventure begins" in the product list
 * Example #4: And I should not see the product "Webship offline product" in the product list
 * Example #5: Then I should see the product "Brown bear notebook" in the product list
 *
 */
Then(/^(I |we )*should( not)* see the product "([^"]*)" in the product list$/, async function (pronounCase, notCase, name) {
  await waitUntil(this,
    () => listedProducts(this),
    (names) => names.includes(name) === !notCase,
    (names) => ({ message: `Expected the product list ${notCase ? 'not ' : ''}to show "${name}". It shows: ${(names || []).join(', ') || 'no product'}.`, hint: LIST_HINT }));
});

/**
 * Assert the product at a position of the product list (first, second,
 * third… or last), to check a sort order.
 *
 * Example #1: Then the first product of the product list should be "Brown bear cushion"
 * Example #2: Then the second product of the product list should be "Brown bear notebook"
 * Example #3: Then the last product of the product list should be "Pack Mug + Framed poster"
 * Example #4: And the third product of the product list should be "Customizable mug"
 * Example #5: Then the first product of the product list should be "Customizable mug"
 *
 */
Then(/^the (first|second|third|fourth|fifth|last) product of the product list should be "([^"]*)"$/, async function (position, name) {
  const at = (names) => (position === 'last' ? names[names.length - 1] : names[['first', 'second', 'third', 'fourth', 'fifth'].indexOf(position)]);
  await waitUntil(this,
    () => listedProducts(this),
    (names) => at(names) === name,
    (names) => ({ message: `Expected the ${position} product of the list to be "${name}", but it is "${at(names || []) || '(none)'}". The list reads: ${(names || []).join(', ')}.`, hint: LIST_HINT }));
});

/**
 * Sort the product list by one of the orders of its "Sort by" menu.
 *
 * Example #1: When I sort the product list by "Name, A to Z"
 * Example #2: When I sort the product list by "Price, low to high"
 * Example #3: When we sort the product list by "Price, high to low"
 * Example #4: And I sort the product list by "Name, Z to A"
 * Example #5: When I sort the product list by "Relevance"
 *
 */
When(/^(I |we )*sort the product list by "([^"]*)"$/, async function (pronounCase, order) {
  const page = this.page;
  const before = (await listedProducts(this)).join('|');
  await actOrExplain('sort the product list by', order, async () => {
    await page.getByRole('button', { name: 'Change sort order' }).first().click({ timeout: budget(this) });
    await page.locator('#js-product-list-top a.js-search-link:visible').filter({ hasText: exactly(order) }).first().click({ timeout: budget(this) });
  }, 'The sort menu is the button "Change sort order" above the product list; its entries are "Relevance", "Name, A to Z", "Price, low to high"…');
  await listChanged(this, before, 'order=');
});

/**
 * Assert the sort order the product list says it uses.
 *
 * Example #1: Then the product list should be sorted by "Name, A to Z"
 * Example #2: Then the product list should be sorted by "Relevance"
 * Example #3: And the product list should be sorted by "Price, low to high"
 * Example #4: Then the product list should be sorted by "Price, high to low"
 * Example #5: Then the product list should be sorted by "Name, Z to A"
 *
 */
Then(/^the product list should be sorted by "([^"]*)"$/, async function (order) {
  await waitUntil(this,
    async () => clean(await this.page.locator('#js-product-list-top').getByRole('button', { name: 'Change sort order' }).first().innerText({ timeout: 2000 })),
    (shown) => shown === order,
    (shown) => ({ message: `Expected the product list to be sorted by "${order}", but it says "${shown}".`, hint: 'The button of the sort menu shows the current order.' }));
});

/**
 * Filter the product list with one option of a filter of the "Filter By"
 * block (the filter is opened first, when it is folded).
 *
 * Example #1: When I filter the product list by "Categories" with "Stationery"
 * Example #2: When I filter the product list by "Color" with "White"
 * Example #3: When we filter the product list by "Brand" with "Graphic Corner"
 * Example #4: And I filter the product list by "Composition" with "Ceramic"
 * Example #5: When I filter the product list by "Availability" with "In stock"
 *
 */
When(/^(I |we )*filter the product list by "([^"]*)" with "([^"]*)"$/, async function (pronounCase, filter, option) {
  const page = this.page;
  const before = (await listedProducts(this)).join('|');
  const block = page.locator('#search_filters_wrapper section[data-name]').filter({ has: page.locator('button').filter({ hasText: exactly(filter) }) }).first();
  await actOrExplain(`filter the product list by "${filter}" with`, option, async () => {
    await block.waitFor({ state: 'visible', timeout: budget(this) });
    const choice = block.locator('label').filter({ hasText: new RegExp('^\\s*' + option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(') }).first();
    if (!(await choice.count())) {
      const options = (await block.locator('label').allTextContents()).map((text) => clean(text).replace(/\s*\(.*$/, ''));
      throw new Error(`The filter "${filter}" has no option "${option}". It has: ${options.join(', ') || '(none)'}.`);
    }
    if (!(await choice.isVisible())) await block.locator('button').first().click();
    await choice.click({ timeout: budget(this) });
  }, 'The filters are the sections of the block "Filter By" (region "Product filters"): Availability, Categories, Color, Brand… each with options such as "Stationery (3)". A filter only lists the options the current products have.');
  await listChanged(this, before, '[?&]q=');
});

/**
 * Assert that the product list shows, or does not show, an active filter
 * ("Categories: Stationery").
 *
 * Example #1: Then the active filters should include "Categories: Stationery"
 * Example #2: Then the active filters should not include "Categories: Stationery"
 * Example #3: And the active filters should include "Color: White"
 * Example #4: Then the active filters should include "Brand: Graphic Corner"
 * Example #5: Then the active filters should not include "Color: Black"
 *
 */
Then(/^the active filters should( not)* include "([^"]*)"$/, async function (notCase, filter) {
  const read = () => this.page.locator('#js-active-search-filters a.js-search-link').evaluateAll((links) => links.map((link) => [...link.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim()));
  await waitUntil(this, read, (filters) => filters.includes(filter) === !notCase, (filters) => ({
    message: `Expected the active filters ${notCase ? 'not ' : ''}to include "${filter}". Active: ${(filters || []).join(', ') || 'none'}.`,
    hint: 'Active filters are the chips above the product list (#js-active-search-filters), written "<filter>: <option>".',
  }));
});

/**
 * Remove an active filter of the product list by pressing its chip.
 *
 * Example #1: When I remove the active filter "Categories: Stationery"
 * Example #2: When we remove the active filter "Color: White"
 * Example #3: And I remove the active filter "Brand: Graphic Corner"
 * Example #4: When I remove the active filter "Composition: Ceramic"
 * Example #5: When remove the active filter "Availability: In stock"
 *
 */
When(/^(I |we )*remove the active filter "([^"]*)"$/, async function (pronounCase, filter) {
  const before = (await listedProducts(this)).join('|');
  await actOrExplain('remove the active filter', filter, () => this.page.locator('#js-active-search-filters a.js-search-link').filter({ hasText: literal(filter) }).first().click({ timeout: budget(this) }), 'Active filters are the chips above the product list (#js-active-search-filters).');
  await listChanged(this, before, '.');
});

/**
 * Go to the next page, the previous page or a numbered page of the product
 * list.
 *
 * Example #1: When I go to the next page of the product list
 * Example #2: When I go to the previous page of the product list
 * Example #3: When I go to page 2 of the product list
 * Example #4: And we go to page 1 of the product list
 * Example #5: When we go to the next page of the product list
 *
 */
When(/^(I |we )*go to (?:the (next|previous) page|page (\d+)) of the product list$/, async function (pronounCase, direction, number) {
  const page = this.page;
  const before = (await listedProducts(this)).join('|');
  const name = direction ? `Go to ${direction} page` : `Go to page ${number}`;
  const control = page.locator('nav[aria-label="Products pagination"]').locator(`[aria-label="${name}"]`).first();
  await actOrExplain('use the pagination of the product list:', name, async () => {
    await control.waitFor({ state: 'visible', timeout: budget(this) });
    if (await control.isDisabled().catch(() => false)) throw new Error(`"${name}" is disabled: there is no such page.`);
    await control.click();
  }, 'The pagination is nav[aria-label="Products pagination"] under the list, with the buttons "Go to previous page", "Go to page N" and "Go to next page". A list of 12 products or fewer has none.');
  await listChanged(this, before, direction === 'previous' || number === '1' ? '.' : 'page=');
});

/**
 * Assert the page of the product list that is shown, by its number.
 *
 * Example #1: Then the product list should be on page 2
 * Example #2: Then the product list should be on page 1
 * Example #3: And the product list should be on page 2
 * Example #4: Then the product list should be on page 3
 * Example #5: But the product list should be on page 1
 *
 */
Then(/^the product list should be on page (\d+)$/, async function (number) {
  await waitUntil(this,
    async () => clean(await this.page.locator('nav[aria-label="Products pagination"] [aria-current="page"]').first().innerText({ timeout: 2000 })),
    (current) => current === String(number),
    (current) => ({ message: `Expected the product list to be on page ${number}, but it is on page ${current || '(no pagination)'}.`, hint: 'The current page is the pagination button with aria-current="page".' }));
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search the shop: type the words in the search box of the header and press
 * Enter. The shop answers with the search results page.
 *
 * Example #1: When I search the shop for "mug"
 * Example #2: When we search the shop for "notebook"
 * Example #3: And I search the shop for "zzzznothing"
 * Example #4: When I search the shop for "Hummingbird printed t-shirt"
 * Example #5: When search the shop for "cushion"
 *
 */
When(/^(I |we )*search the shop for "([^"]*)"$/, async function (pronounCase, words) {
  const box = this.page.locator('form[role="search"] input[name="s"]:visible').first();
  await actOrExplain('search the shop for', words, async () => {
    await box.fill(words, { timeout: budget(this) });
    await box.press('Enter');
  }, 'The search box is the field "Search products..." of the header (form[role=search] input[name=s]); on a narrow window it is behind the search button.');
  await settle(this);
});

/**
 * Type words in the search box of the header without sending them, to see
 * the suggestions the shop offers while typing.
 *
 * Example #1: When I type "mug" in the shop search
 * Example #2: When we type "note" in the shop search
 * Example #3: And I type "cushion" in the shop search
 * Example #4: When I type "Humm" in the shop search
 * Example #5: When type "poster" in the shop search
 *
 */
When(/^(I |we )*type "([^"]*)" in the shop search$/, async function (pronounCase, words) {
  const box = this.page.locator('form[role="search"] input[name="s"]:visible').first();
  await actOrExplain('type in the shop search:', words, () => box.pressSequentially(words, { delay: 60, timeout: budget(this) }), 'The search box is the field "Search products..." of the header.');
});

/**
 * Assert that the suggestions under the search box include, or do not
 * include, a product.
 *
 * Example #1: Then the search suggestions should include "Customizable mug"
 * Example #2: Then the search suggestions should not include "Hummingbird printed t-shirt"
 * Example #3: And the search suggestions should include "Mug The adventure begins"
 * Example #4: Then the search suggestions should include "Brown bear notebook"
 * Example #5: Then the search suggestions should not include "Mountain fox cushion"
 *
 */
Then(/^the search suggestions should( not)* include "([^"]*)"$/, async function (notCase, name) {
  const options = this.page.locator('#ps_searchbar_results [role="option"]:visible');
  const read = async () => (await options.allInnerTexts()).map(clean);
  await waitUntil(this, read, (names) => (notCase ? names.length > 0 && !names.includes(name) : names.includes(name)), (names) => ({
    message: `Expected the search suggestions ${notCase ? 'not ' : ''}to include "${name}". They are: ${(names || []).join(', ') || 'none'}.`,
    hint: 'Suggestions are the options of the list under the search box (#ps_searchbar_results [role=option]); they appear a moment after typing three letters or more.',
  }));
});

// ---------------------------------------------------------------------------
// Product page
// ---------------------------------------------------------------------------

const PAGE_HINT = 'The product page holds the form #add-to-cart-or-refresh: the options (.js-product-variants), the quantity (#quantity_wanted) and the button "Add to cart". Related products on the same page have their own buttons.';

/** The purchase form of the product page. */
function productForm(world) {
  return world.page.locator('#add-to-cart-or-refresh');
}

/**
 * Open the page of a product by pressing its name on a product card of the
 * current page (the home page, a category, the search results).
 *
 * Example #1: When I open the product "Hummingbird printed t-shirt"
 * Example #2: When we open the product "Customizable mug"
 * Example #3: And I open the product "Mug The adventure begins"
 * Example #4: When I open the product "Brown bear notebook"
 * Example #5: When open the product "Mountain fox cushion"
 *
 */
When(/^(I |we )*open the product "([^"]*)"$/, async function (pronounCase, name) {
  const page = this.page;
  const title = page.locator('.js-product-miniature:visible').locator(CARD_TITLE).filter({ hasText: exactly(name) }).first();
  await actOrExplain('open the product', name, () => title.click({ timeout: budget(this) }), 'The product must be on a card of the current page: ' + ((await page.locator('.js-product-miniature:visible').locator(CARD_TITLE).allInnerTexts().catch(() => [])).map(clean).slice(0, 12).join(', ') || 'this page has no product card') + '.');
  await settle(this);
});

/**
 * Choose a value for an option of the product (a combination): a size in a
 * list, a color among swatches. The page loads the combination and changes
 * its address.
 *
 * Example #1: When I choose "M" for the product option "Size"
 * Example #2: When I choose "Black" for the product option "Color"
 * Example #3: When we choose "L" for the product option "Size"
 * Example #4: And I choose "White" for the product option "Color"
 * Example #5: When I choose "Ruled" for the product option "Paper Type"
 *
 */
When(/^(I |we )*choose "([^"]*)" for the product option "([^"]*)"$/, async function (pronounCase, value, option) {
  const page = this.page;
  const group = productForm(this).locator('.js-product-variants fieldset').filter({ has: page.locator('legend').filter({ hasText: exactly(option) }) }).first();
  await actOrExplain(`choose "${value}" for the product option`, option, async () => {
    await group.waitFor({ state: 'visible', timeout: budget(this) });
    const before = page.url();
    const select = group.locator('select').first();
    if (await select.count()) {
      if ((await select.locator('option:checked').innerText()).trim() === value) return;
      const values = (await select.locator('option').allTextContents()).map(clean);
      if (!values.includes(value)) throw new Error(`The option "${option}" has no value "${value}". It has: ${values.join(', ')}.`);
      await select.selectOption({ label: value });
    } else {
      const choice = group.locator('label').filter({ hasText: new RegExp('(^|-\\s*)' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first();
      if (!(await choice.count())) throw new Error(`The option "${option}" has no value "${value}". It has: ${(await group.locator('label').allTextContents()).map((text) => clean(text).replace(/^.*-\s*/, '')).join(', ')}.`);
      if (await group.locator('input[type="radio"]:checked + label, label:has(input:checked)').filter({ hasText: literal(value) }).count()) return;
      await choice.click({ timeout: budget(this) });
    }
    // The page asks the shop for the combination and rewrites the address.
    await page.waitForFunction((url) => location.href !== url, before, { timeout: budget(this) });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }, PAGE_HINT + ' An option is a fieldset with its name as legend; a list option is a select, a color option is a group of radios named "Color - <value>".');
});

/**
 * Assert the value the product page shows as chosen for an option.
 *
 * Example #1: Then the product option "Size" should be "M"
 * Example #2: Then the product option "Color" should be "Black"
 * Example #3: And the product option "Size" should be "S"
 * Example #4: Then the product option "Color" should be "White"
 * Example #5: Then the product option "Paper Type" should be "Ruled"
 *
 */
Then(/^the product option "([^"]*)" should be "([^"]*)"$/, async function (option, value) {
  const page = this.page;
  const group = productForm(this).locator('.js-product-variants fieldset').filter({ has: page.locator('legend').filter({ hasText: exactly(option) }) }).first();
  const read = async () => {
    const select = group.locator('select').first();
    if (await select.count()) return clean(await select.locator('option:checked').innerText({ timeout: 2000 }));
    return clean(await group.locator('input[type="radio"]:checked').first().evaluate((radio) => (radio.labels[0] || radio.parentElement).textContent, null, { timeout: 2000 })).replace(/^.*-\s*/, '');
  };
  await waitUntil(this, read, (chosen) => chosen === value, (chosen) => ({
    message: `Expected the product option "${option}" to be "${value}", but it is "${chosen || '(not found)'}".`,
    hint: PAGE_HINT,
  }));
});

/**
 * Set the quantity to buy on the product page.
 *
 * Example #1: When I set the quantity to buy to 2
 * Example #2: When we set the quantity to buy to 1
 * Example #3: And I set the quantity to buy to 10
 * Example #4: When I set the quantity to buy to 3
 * Example #5: When set the quantity to buy to 5
 *
 */
When(/^(I |we )*set the quantity to buy to (\d+)$/, async function (pronounCase, quantity) {
  await actOrExplain('set the quantity to buy to', quantity, () => productForm(this).locator('#quantity_wanted, input[name="qty"]').first().fill(String(quantity), { timeout: budget(this) }), PAGE_HINT);
});

/**
 * Assert the price the product page shows for the product (the current
 * price, after a discount), as the page writes it.
 *
 * Example #1: Then the price of the product should be "$19.12"
 * Example #2: Then the price of the product should be "$11.90"
 * Example #3: And the price of the product should be "$28.72"
 * Example #4: Then the price of the product should be "$13.90"
 * Example #5: Then the price of the product should be "$35.00"
 *
 */
Then(/^the price of the product should be "([^"]*)"$/, async function (price) {
  await waitUntil(this,
    async () => clean(await this.page.locator('.product__prices').first().innerText({ timeout: 2000 })),
    (shown) => shown.replace(/^.*Price:\s*/, '').startsWith(price) || shown.split(' ').includes(price),
    (shown) => ({ message: `Expected the price of the product to be "${price}", but the page shows "${shown}".`, hint: 'A discounted product shows "Regular price: $23.90 (Save 20%) Price: $19.12"; the step reads the current price.' }));
});

/**
 * Add the product of the product page to the cart ("Add to cart") and wait
 * for the dialog that confirms it.
 *
 * Example #1: When I add the product to the cart
 * Example #2: When we add the product to the cart
 * Example #3: And I add the product to the cart
 * Example #4: Then I add the product to the cart
 * Example #5: When add the product to the cart
 *
 */
When(/^(I |we )*add the product to the cart$/, async function (pronounCase) {
  const page = this.page;
  const button = productForm(this).locator('button[data-button-action="add-to-cart"]').first();
  await actOrExplain('add', 'the product to the cart', async () => {
    await button.waitFor({ state: 'visible', timeout: budget(this) });
    if (await button.isDisabled()) throw new Error('"Add to cart" is disabled: ' + (clean(await page.locator('#product-availability').innerText({ timeout: 1000 }).catch(() => '')) || 'the product cannot be ordered') + '.');
    await button.click();
    await page.locator('#blockcart-modal.show').waitFor({ state: 'visible', timeout: budget(this) });
  }, PAGE_HINT + ' After the click the shop opens the dialog "Added to your cart" (#blockcart-modal).');
});

/**
 * Assert that the dialog shown after "Add to cart" contains a text: the name
 * of the product, an option ("Size: M"), the quantity ("Quantity: 2") or the
 * count ("There are 2 items in your cart.").
 *
 * Example #1: Then the cart dialog should show "Hummingbird printed t-shirt"
 * Example #2: Then the cart dialog should show "Size: M"
 * Example #3: Then the cart dialog should show "Quantity: 2"
 * Example #4: And the cart dialog should show "There are 2 items in your cart."
 * Example #5: Then the cart dialog should show "Added to your cart"
 *
 */
Then(/^the cart dialog should show "([^"]*)"$/, async function (text) {
  await waitUntil(this,
    async () => clean(await this.page.locator('#blockcart-modal:visible').first().innerText({ timeout: 2000 })),
    (shown) => shown.includes(text),
    (shown) => ({ message: shown ? `Expected the cart dialog to show "${text}", but it reads "${shown.slice(0, 260)}".` : `Expected the cart dialog to show "${text}", but the dialog is not open.`, hint: 'The cart dialog (#blockcart-modal, "Added to your cart") opens after "Add to cart".' }));
});

/**
 * Leave the cart dialog: keep shopping on the same page ("Continue
 * shopping"), or go on to the cart ("Proceed to checkout").
 *
 * Example #1: When I continue shopping from the cart dialog
 * Example #2: When I proceed to checkout from the cart dialog
 * Example #3: When we continue shopping from the cart dialog
 * Example #4: And I proceed to checkout from the cart dialog
 * Example #5: When proceed to checkout from the cart dialog
 *
 */
When(/^(I |we )*(continue shopping|proceed to checkout) from the cart dialog$/, async function (pronounCase, choice) {
  const box = this.page.locator('#blockcart-modal:visible').first();
  await actOrExplain(choice, 'from the cart dialog', async () => {
    if (choice === 'continue shopping') {
      await box.locator('.modal-footer button').first().click({ timeout: budget(this) });
      await box.waitFor({ state: 'hidden', timeout: budget(this) });
    } else {
      await box.locator('.modal-footer a').first().click({ timeout: budget(this) });
    }
  }, 'The cart dialog has the button "Continue shopping" and the link "Proceed to checkout", which opens the cart page.');
  await settle(this);
});

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

const CART_HINT = 'The cart page lists its lines as .js-cart-item; the quantity of a line is input.js-cart-line-product-quantity and its remove link a.js-remove-from-cart. Featured products under the cart are not cart lines.';

/**
 * Empty the cart of the visitor: open the cart page and remove every line.
 * A cart is kept for a signed-in customer between sessions, so a scenario
 * that needs an empty cart starts with this step.
 *
 * Example #1: Given my cart is empty
 * Example #2: Given our cart is empty
 * Example #3: And my cart is empty
 * Example #4: When my cart is empty
 * Example #5: Then my cart is empty
 *
 */
Given(/^(my|our) cart is empty$/, async function (whose) {
  const page = this.page;
  await open(this, shopPage(this, 'cart&action=show'));
  for (let round = 0; round < 30; round += 1) {
    const lines = cartLines(this);
    const count = await lines.count();
    if (!count) return;
    await lines.first().locator('a.js-remove-from-cart').first().click({ timeout: budget(this) });
    await page.waitForFunction((before) => document.querySelectorAll('.js-cart-item').length < before, count, { timeout: budget(this) }).catch(() => {});
  }
  throw friendly({ message: 'Could not empty the cart: lines are still listed after 30 removals.', hint: CART_HINT });
});

/**
 * Assert that the cart page lists, or does not list, a product.
 *
 * Example #1: Then the cart should contain "Hummingbird printed t-shirt"
 * Example #2: Then the cart should not contain "Customizable mug"
 * Example #3: And the cart should contain "Mug The best is yet to come"
 * Example #4: Then the cart should contain "Mug The adventure begins"
 * Example #5: Then the cart should not contain "Hummingbird printed t-shirt"
 *
 */
Then(/^the cart should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  await assertPresence(cartLines(this, name), notCase, {
    label: `"${name}" in the cart`,
    hint: CART_HINT,
    timeout: budget(this),
    found: async () => (await cartLines(this).evaluateAll((lines) => lines.map((line) => line.innerText.replace(/\s+/g, ' ').trim().slice(0, 60)))).join(' | ') || 'an empty cart',
  });
});

/**
 * Assert how many items the cart holds (the sum of the quantities), as the
 * shop itself counts them.
 *
 * Example #1: Then the cart should hold 2 items
 * Example #2: Then the cart should hold 1 item
 * Example #3: Then the cart should hold 0 items
 * Example #4: And the cart should hold 4 items
 * Example #5: Then the cart should hold 3 items
 *
 */
Then(/^the cart should hold (\d+) items?$/, async function (count) {
  await waitUntil(this,
    async () => (await shopState(this)).cartCount,
    (held) => held === Number(count),
    (held) => ({ message: `Expected the cart to hold ${count} item(s), but it holds ${held}.`, hint: 'The count is prestashop.cart.products_count, the number the header shows on the cart button ("View cart (2 products)").' }));
});

/**
 * Change the quantity of a line of the cart page: type the number and press
 * Enter. The cart updates in place.
 *
 * Example #1: When I change the cart quantity of "Hummingbird printed t-shirt" to 3
 * Example #2: When we change the cart quantity of "Customizable mug" to 1
 * Example #3: And I change the cart quantity of "Mug The best is yet to come" to 2
 * Example #4: When I change the cart quantity of "Mug The adventure begins" to 5
 * Example #5: When change the cart quantity of "Hummingbird printed t-shirt" to 2
 *
 */
When(/^(I |we )*change the cart quantity of "([^"]*)" to (\d+)$/, async function (pronounCase, name, quantity) {
  const page = this.page;
  const line = cartLines(this, name).first();
  await actOrExplain('change the cart quantity of', name, async () => {
    const field = line.locator('input.js-cart-line-product-quantity').first();
    await field.fill(String(quantity), { timeout: budget(this) });
    await field.press('Enter');
    // The cart is redrawn: wait for the line to show the new quantity and for the shop to count it.
    await page.waitForFunction(([product, wanted]) => [...document.querySelectorAll('.js-cart-item')].some((node) => node.innerText.includes(product) && node.querySelector('input.js-cart-line-product-quantity').value === wanted), [name, String(quantity)], { timeout: budget(this) });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }, CART_HINT);
});

/**
 * Assert the quantity of a line of the cart page.
 *
 * Example #1: Then the cart quantity of "Hummingbird printed t-shirt" should be 3
 * Example #2: Then the cart quantity of "Customizable mug" should be 1
 * Example #3: And the cart quantity of "Mug The best is yet to come" should be 2
 * Example #4: Then the cart quantity of "Mug The adventure begins" should be 5
 * Example #5: Then the cart quantity of "Hummingbird printed t-shirt" should be 2
 *
 */
Then(/^the cart quantity of "([^"]*)" should be (\d+)$/, async function (name, quantity) {
  await waitUntil(this,
    () => cartLines(this, name).first().locator('input.js-cart-line-product-quantity').first().inputValue({ timeout: 2000 }),
    (value) => value === String(quantity),
    (value) => ({ message: `Expected the cart quantity of "${name}" to be ${quantity}, but it is ${value === undefined ? 'not in the cart' : value}.`, hint: CART_HINT }));
});

/**
 * Remove a product from the cart page with the "Remove" link of its line.
 *
 * Example #1: When I remove "Hummingbird printed t-shirt" from the cart
 * Example #2: When we remove "Customizable mug" from the cart
 * Example #3: And I remove "Mug The best is yet to come" from the cart
 * Example #4: When I remove "Mug The adventure begins" from the cart
 * Example #5: When remove "Hummingbird printed t-shirt" from the cart
 *
 */
When(/^(I |we )*remove "([^"]*)" from the cart$/, async function (pronounCase, name) {
  const line = cartLines(this, name).first();
  await actOrExplain('remove from the cart:', name, async () => {
    await line.locator('a.js-remove-from-cart').first().click({ timeout: budget(this) });
    await cartLines(this, name).first().waitFor({ state: 'hidden', timeout: budget(this) });
  }, CART_HINT);
});

/**
 * Assert that the cart page says the cart is empty.
 *
 * Example #1: Then the cart should be empty
 * Example #2: And the cart should be empty
 * Example #3: But the cart should be empty
 * Example #4: Then the cart should be empty
 * Example #5: And the cart should be empty
 *
 */
Then(/^the cart should be empty$/, async function () {
  await waitUntil(this,
    async () => ({ lines: await cartLines(this).count(), count: (await shopState(this)).cartCount }),
    (cart) => cart.lines === 0 && cart.count === 0,
    (cart) => ({ message: `Expected an empty cart, but it has ${cart ? cart.lines : '?'} line(s) and ${cart ? cart.count : '?'} item(s).`, hint: 'An empty cart page says "There are no more items in your cart" and its "Proceed to checkout" button is disabled.' }));
});

/**
 * Apply a voucher (a cart rule code) on the cart page: open "Promo code",
 * type the code and press "Apply". A refused code shows a field error.
 *
 * Example #1: When I apply the voucher "WEBSHIP10"
 * Example #2: When we apply the voucher "NOPE"
 * Example #3: And I apply the voucher "WEBSHIP10"
 * Example #4: When I apply the voucher "SUMMER"
 * Example #5: When apply the voucher "WEBSHIP10"
 *
 */
When(/^(I |we )*apply the voucher "([^"]*)"$/, async function (pronounCase, code) {
  const page = this.page;
  const block = page.locator('.js-cart-voucher:visible').first();
  await actOrExplain('apply the voucher', code, async () => {
    const field = block.locator('input[name="discount_name"]').first();
    if (!(await field.isVisible())) await block.locator('button.accordion-button').first().click({ timeout: budget(this) });
    await field.fill(code, { timeout: budget(this) });
    await block.locator('form button[type="submit"]').first().click();
    await page.locator('.js-cart-voucher .js-error:visible, [aria-label="Added vouchers"]:visible').first().waitFor({ state: 'visible', timeout: budget(this) });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }, 'The voucher form is the folded block "Promo code" of the cart summary: the field "Paste your voucher here" and the button "Apply".');
});

/**
 * Assert that the cart lists, or does not list, an applied voucher by the
 * name of its cart rule.
 *
 * Example #1: Then the cart should have the voucher "Webship ten percent"
 * Example #2: Then the cart should not have the voucher "Webship ten percent"
 * Example #3: And the cart should have the voucher "Summer sale"
 * Example #4: Then the cart should not have the voucher "Summer sale"
 * Example #5: But the cart should not have the voucher "Webship ten percent"
 *
 */
Then(/^the cart should( not)* have the voucher "([^"]*)"$/, async function (notCase, name) {
  await assertPresence(this.page.locator('[aria-label="Added vouchers"] li:visible').filter({ hasText: literal(name) }), notCase, {
    label: `the voucher "${name}" in the cart`,
    hint: 'Applied vouchers are the list "Added vouchers" of the cart summary, each with its discount and a remove link.',
    timeout: budget(this),
    found: async () => clean(await this.page.locator('.js-cart-summary').first().innerText({ timeout: 1000 }).catch(() => '')).slice(0, 200),
  });
});

/**
 * Remove an applied voucher from the cart.
 *
 * Example #1: When I remove the voucher "Webship ten percent"
 * Example #2: When we remove the voucher "Summer sale"
 * Example #3: And I remove the voucher "Webship ten percent"
 * Example #4: Then I remove the voucher "Webship ten percent"
 * Example #5: When remove the voucher "Summer sale"
 *
 */
When(/^(I |we )*remove the voucher "([^"]*)"$/, async function (pronounCase, name) {
  const item = this.page.locator('[aria-label="Added vouchers"] li:visible').filter({ hasText: literal(name) }).first();
  await actOrExplain('remove the voucher', name, async () => {
    await item.locator('a').first().click({ timeout: budget(this) });
    await item.waitFor({ state: 'hidden', timeout: budget(this) });
  }, 'Each applied voucher has a remove link named "Remove voucher: <name>".');
});

/**
 * Assert a line of the cart summary: its label and its amount, as the cart
 * writes them ("Total (tax incl.)" and "$45.24", "Shipping" and "$7.00",
 * "Discount(s)" and "-$7.65").
 *
 * Example #1: Then the cart summary should show "Total (tax incl.)" as "$45.24"
 * Example #2: Then the cart summary should show "Shipping" as "$7.00"
 * Example #3: And the cart summary should show "Discount(s)" as "-$7.65"
 * Example #4: Then the cart summary should show "2 items" as "$38.24"
 * Example #5: Then the cart summary should show "Total (tax excl.)" as "$83.48"
 *
 */
Then(/^the cart summary should show "([^"]*)" as "([^"]*)"$/, async function (label, amount) {
  const wanted = `${label} ${amount}`;
  await waitUntil(this,
    async () => clean(await this.page.locator('.js-cart-summary').first().innerText({ timeout: 2000 })),
    (summary) => summary.includes(wanted),
    (summary) => ({ message: `Expected the cart summary to show "${label}" as "${amount}", but it reads "${(summary || '').slice(0, 260)}".`, hint: 'The summary is the block at the right of the cart page; the first line counts the items ("2 items $38.24").' }));
});

/**
 * Go on from the cart page to the checkout ("Proceed to checkout").
 *
 * Example #1: When I proceed to checkout
 * Example #2: When we proceed to checkout
 * Example #3: And I proceed to checkout
 * Example #4: Then I proceed to checkout
 * Example #5: When proceed to checkout
 *
 */
When(/^(I |we )*proceed to checkout$/, async function (pronounCase) {
  const page = this.page;
  if ((await shopState(this)).page !== 'cart') await open(this, shopPage(this, 'cart&action=show'));
  const link = page.locator('.js-cart-detailed-actions a:visible').first();
  if (!(await link.count())) {
    throw friendly({ message: 'Could not proceed to checkout: the cart is empty, so "Proceed to checkout" is disabled.', hint: 'Add a product to the cart first.' });
  }
  await link.click({ timeout: budget(this) });
  await settle(this);
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

const CHECKOUT_HINT = 'The checkout has four steps, #checkout-personal-information-step, #checkout-addresses-step, #checkout-delivery-step and #checkout-payment-step; the open one is marked as current and its name is the title of the page.';

/** The open step of the checkout, or a friendly error. */
async function currentStep(world) {
  const step = checkoutStep(world);
  try {
    await step.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `Expected the checkout, but the page is a "${(await shopState(world)).page}" page.`, hint: 'Put a product in the cart and proceed to checkout first. ' + CHECKOUT_HINT });
  }
  return step;
}

const STEP_NAMES = { 'personal information': 'checkout-personal-information-step', 'addresses': 'checkout-addresses-step', 'shipping method': 'checkout-delivery-step', 'payment': 'checkout-payment-step' };

/**
 * Assert which step of the checkout is open.
 *
 * Example #1: Then the checkout step should be "Personal Information"
 * Example #2: Then the checkout step should be "Addresses"
 * Example #3: Then the checkout step should be "Shipping Method"
 * Example #4: And the checkout step should be "Payment"
 * Example #5: Then the checkout step should be "addresses"
 *
 */
Then(/^the checkout step should be "([^"]*)"$/, async function (name) {
  const id = STEP_NAMES[String(name).toLowerCase()];
  if (!id) throw friendly({ message: `"${name}" is not a step of the checkout.`, hint: 'The steps are "Personal Information", "Addresses", "Shipping Method" and "Payment".' });
  await waitUntil(this,
    () => checkoutStep(this).getAttribute('id', { timeout: 2000 }),
    (current) => current === id,
    (current) => ({ message: `Expected the checkout step "${name}", but the open step is "${Object.keys(STEP_NAMES).find((key) => STEP_NAMES[key] === current) || current || 'none'}".`, hint: CHECKOUT_HINT + ' A signed-in customer starts at "Addresses".' }));
});

/**
 * Fill in a text field of the open checkout step, by its label ("First
 * name", "Email", "Address", "City", "Zip/Postal Code"…).
 *
 * Example #1: When I fill in the checkout field "First name" with "Greta"
 * Example #2: When I fill in the checkout field "Email" with "guest-buyer@example.com"
 * Example #3: When we fill in the checkout field "Address" with "1 Test Lane"
 * Example #4: And I fill in the checkout field "Zip/Postal Code" with "33133"
 * Example #5: When I fill in the checkout field "City" with "Miami"
 *
 */
When(/^(I |we )*fill in the checkout field "([^"]*)" with "([^"]*)"$/, async function (pronounCase, label, value) {
  const step = await currentStep(this);
  await actOrExplain('fill in the checkout field', label, () => step.getByRole('textbox', { name: label, exact: true }).first().fill(value, { timeout: budget(this) }), 'Checkout fields are found by their label inside the open step. Fields of this step: ' + (await step.locator('input:visible, select:visible').evaluateAll((fields) => fields.map((field) => (field.labels && field.labels[0] ? field.labels[0].innerText : field.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean))).join(', ') + '.');
});

/**
 * Choose an option of a list field of the open checkout step, by its label
 * ("State", "Country").
 *
 * Example #1: When I select "Florida" for the checkout field "State"
 * Example #2: When we select "United States" for the checkout field "Country"
 * Example #3: And I select "Texas" for the checkout field "State"
 * Example #4: When I select "New York" for the checkout field "State"
 * Example #5: When select "Florida" for the checkout field "State"
 *
 */
When(/^(I |we )*select "([^"]*)" for the checkout field "([^"]*)"$/, async function (pronounCase, option, label) {
  const step = await currentStep(this);
  await actOrExplain(`select "${option}" for the checkout field`, label, () => step.getByRole('combobox', { name: label, exact: true }).first().selectOption({ label: option }, { timeout: budget(this) }), 'List fields of the address step are "State" and "Country".');
});

/**
 * Tick a consent or an option of the open checkout step, by the start of its
 * label ("Customer data privacy", "I agree to the terms and conditions and
 * the privacy policy", "Sign up for our newsletter").
 *
 * Example #1: When I tick the checkout box "Customer data privacy"
 * Example #2: When I tick the checkout box "I agree to the terms and conditions and the privacy policy"
 * Example #3: When we tick the checkout box "Sign up for our newsletter"
 * Example #4: And I tick the checkout box "Receive offers from our partners"
 * Example #5: When tick the checkout box "Customer data privacy"
 *
 */
When(/^(I |we )*tick the checkout box "([^"]*)"$/, async function (pronounCase, label) {
  const step = await currentStep(this);
  await actOrExplain('tick the checkout box', label, () => step.getByRole('checkbox', { name: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().check({ timeout: budget(this) }), 'The boxes of the first step are "Receive offers from our partners", "Customer data privacy", "Sign up for our newsletter" and "I agree to the terms and conditions and the privacy policy".');
});

/**
 * Choose one of the saved addresses of the customer as the delivery address,
 * by its alias, on the Addresses step.
 *
 * Example #1: When I choose the delivery address "Home"
 * Example #2: When we choose the delivery address "Office"
 * Example #3: And I choose the delivery address "Home"
 * Example #4: When I choose the delivery address "My Address"
 * Example #5: When choose the delivery address "Office"
 *
 */
When(/^(I |we )*choose the delivery address "([^"]*)"$/, async function (pronounCase, alias) {
  const step = await currentStep(this);
  await actOrExplain('choose the delivery address', alias, () => step.locator('label').filter({ has: this.page.locator('input[name="id_address_delivery"]') }).filter({ hasText: new RegExp('^\\s*' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b') }).first().click({ timeout: budget(this) }), 'Saved addresses are radios named id_address_delivery on the Addresses step; each label starts with the alias of the address.');
});

/**
 * Choose a delivery option (a carrier) by its name on the Shipping Method
 * step.
 *
 * Example #1: When I choose the delivery option "My carrier"
 * Example #2: When we choose the delivery option "Click and collect"
 * Example #3: And I choose the delivery option "My carrier"
 * Example #4: When I choose the delivery option "My cheap carrier"
 * Example #5: When choose the delivery option "My carrier"
 *
 */
When(/^(I |we )*choose the delivery option "([^"]*)"$/, async function (pronounCase, carrier) {
  const step = await currentStep(this);
  await actOrExplain('choose the delivery option', carrier, () => step.locator('label').filter({ has: this.page.locator('input[name^="delivery_option"]') }).or(step.locator('.js-delivery-option label')).filter({ hasText: literal(carrier) }).first().click({ timeout: budget(this) }), 'Delivery options are the carriers that serve the delivery address. This step offers: ' + (await step.locator('.js-delivery-option').allInnerTexts().catch(() => [])).map(clean).join(' | ') + '.');
});

/**
 * Confirm the open checkout step and go to the next one (its "Continue"
 * button), then wait for the next step to open. Fails with what the browser
 * or the shop said when the step refuses to continue.
 *
 * Example #1: When I continue the checkout
 * Example #2: When we continue the checkout
 * Example #3: And I continue the checkout
 * Example #4: Then I continue the checkout
 * Example #5: When continue the checkout
 *
 */
When(/^(I |we )*continue the checkout$/, async function (pronounCase) {
  const page = this.page;
  const step = await currentStep(this);
  const id = await step.getAttribute('id');
  await step.locator('button[name="continue"]:visible, button[name="confirm-addresses"]:visible, button[name="confirmDeliveryOption"]:visible').first().click({ timeout: budget(this) }).catch((err) => {
    throw friendly({ action: 'continue', target: 'the checkout', cause: err, hint: 'The last step has no "Continue": choose a payment method, accept the terms and place the order.' });
  });
  await settle(this);
  const deadline = Date.now() + budget(this);
  while (Date.now() < deadline) {
    const now = await checkoutStep(this).getAttribute('id', { timeout: 1000 }).catch(() => id);
    if (now && now !== id) return;
    await page.waitForTimeout(200);
  }
  const invalid = await page.locator(`#${id} :invalid`).evaluateAll((fields) => fields.filter((field) => field.tagName !== 'FORM' && field.tagName !== 'FIELDSET').map((field) => `${(field.labels && field.labels[0] ? field.labels[0].innerText : field.name).replace(/\s+/g, ' ').trim().slice(0, 40)}: ${field.validationMessage}`));
  throw friendly({
    message: `The checkout stayed on the step "${Object.keys(STEP_NAMES).find((key) => STEP_NAMES[key] === id)}". ${invalid.length ? 'The browser refused: ' + invalid.join('; ') + '.' : 'The page says: ' + (await messagesSeen(this)) + '.'}`,
    hint: 'Required fields of a step are stopped by the browser before the shop sees them; fill them and tick the required boxes.',
  });
});

/**
 * Choose a payment method on the Payment step, by the label of its option
 * ("Pay by bank wire", "Pay by Check", "Pay by Cash on Delivery").
 *
 * Example #1: When I choose the payment method "Pay by bank wire"
 * Example #2: When I choose the payment method "Pay by Check"
 * Example #3: When we choose the payment method "Pay by Cash on Delivery"
 * Example #4: And I choose the payment method "Pay by bank wire"
 * Example #5: When choose the payment method "Pay by Check"
 *
 */
When(/^(I |we )*choose the payment method "([^"]*)"$/, async function (pronounCase, method) {
  const step = await currentStep(this);
  await actOrExplain('choose the payment method', method, async () => {
    await step.locator('label').filter({ hasText: exactly(method) }).first().click({ timeout: budget(this) });
    await this.page.waitForFunction(() => !!document.querySelector('input[name="payment-option"]:checked'), null, { timeout: budget(this) });
  }, 'Payment methods are the radios named payment-option of the Payment step. This shop offers: ' + (await step.locator('input[name="payment-option"]').evaluateAll((radios) => radios.map((radio) => (radio.labels[0] ? radio.labels[0].innerText : '').replace(/\s+/g, ' ').trim())).catch(() => [])).join(', ') + '.');
});

/**
 * Accept the terms of service on the Payment step (the box "I agree to the
 * terms of service…").
 *
 * Example #1: When I accept the terms of service
 * Example #2: When we accept the terms of service
 * Example #3: And I accept the terms of service
 * Example #4: Then I accept the terms of service
 * Example #5: When accept the terms of service
 *
 */
When(/^(I |we )*accept the terms of service$/, async function (pronounCase) {
  const step = await currentStep(this);
  await actOrExplain('accept', 'the terms of service', () => step.locator('#conditions-to-approve input[type="checkbox"]').first().check({ timeout: budget(this) }), 'The terms are the box of the form #conditions-to-approve on the Payment step.');
});

/**
 * Assert whether the "Place Order" button of the Payment step can be
 * pressed: it stays disabled until a payment method is chosen and the terms
 * are accepted.
 *
 * Example #1: Then the place order button should be disabled
 * Example #2: Then the place order button should be enabled
 * Example #3: And the place order button should be disabled
 * Example #4: But the place order button should be enabled
 * Example #5: Then the place order button should be disabled
 *
 */
Then(/^the place order button should be (enabled|disabled)$/, async function (state) {
  const button = this.page.locator('#payment-confirmation button').first();
  await waitUntil(this,
    () => button.isDisabled({ timeout: 2000 }),
    (disabled) => disabled === (state === 'disabled'),
    (disabled) => ({ message: `Expected the "Place Order" button to be ${state}, but it is ${disabled === undefined ? 'not on the page' : disabled ? 'disabled' : 'enabled'}.`, hint: 'The button is #payment-confirmation button on the Payment step.' }));
});

/**
 * Place the order ("Place Order") and wait for the order confirmation page.
 * The step remembers the reference of the order for the steps that speak of
 * "the placed order".
 *
 * Example #1: When I place the order
 * Example #2: When we place the order
 * Example #3: And I place the order
 * Example #4: Then I place the order
 * Example #5: When place the order
 *
 */
When(/^(I |we )*place the order$/, async function (pronounCase) {
  const page = this.page;
  const button = page.locator('#payment-confirmation button').first();
  await actOrExplain('place', 'the order', async () => {
    await button.waitFor({ state: 'visible', timeout: budget(this) });
    if (await button.isDisabled()) throw new Error('"Place Order" is disabled: choose a payment method and accept the terms of service first.');
    await button.click();
    await page.waitForURL(/order-confirmation|controller=order-confirmation/, { timeout: 30000 });
  }, CHECKOUT_HINT);
  await settle(this);
  const lines = (await page.locator('.order-confirmation__details li').allInnerTexts().catch(() => [])).map(clean);
  const reference = (lines.find((line) => /^Order reference:/i.test(line)) || '').replace(/^Order reference:\s*/i, '');
  const state = memory(this);
  state.orderReference = reference;
  state.orderId = new URL(page.url()).searchParams.get('id_order');
  if (!reference) {
    throw friendly({ message: 'The order was placed, but its reference was not found on the confirmation page.', hint: 'The confirmation page lists "Order reference: XXXXXXXXX" under "Order details".' });
  }
});

/**
 * Assert that the order confirmation page is shown ("Your order is
 * confirmed").
 *
 * Example #1: Then the order should be confirmed
 * Example #2: And the order should be confirmed
 * Example #3: But the order should be confirmed
 * Example #4: Then the order should be confirmed
 * Example #5: And the order should be confirmed
 *
 */
Then(/^the order should be confirmed$/, async function () {
  await waitUntil(this,
    async () => ({ page: (await shopState(this)).page, title: clean(await this.page.locator('h1').first().innerText({ timeout: 2000 }).catch(() => '')) }),
    (now) => now.page === 'order-confirmation',
    (now) => ({ message: `Expected the order confirmation page, but the page is a "${now ? now.page : 'unknown'}" page titled "${now ? now.title : ''}". `, hint: 'After "Place Order" the shop shows the page "Your order is confirmed" (body id order-confirmation).' }));
});

/**
 * Assert a detail of the order confirmation page, as it is written under
 * "Order details" ("Payment method: Bank transfer", "Shipping method: My
 * carrier") or anywhere else on the page.
 *
 * Example #1: Then the order confirmation should show "Payment method: Bank transfer"
 * Example #2: Then the order confirmation should show "Shipping method: My carrier"
 * Example #3: And the order confirmation should show "Mug The best is yet to come"
 * Example #4: Then the order confirmation should show "Payment method: Payments by check"
 * Example #5: Then the order confirmation should show "An email has been sent to the guest-buyer@example.com address."
 *
 */
Then(/^the order confirmation should show "([^"]*)"$/, async function (text) {
  await waitUntil(this,
    async () => ((await shopState(this)).page === 'order-confirmation' ? clean(await this.page.locator('#main, main').first().innerText({ timeout: 2000 })) : ''),
    (shown) => shown.includes(text),
    (shown) => ({ message: shown ? `Expected the order confirmation to show "${text}", but it reads "${shown.slice(0, 400)}".` : `Expected the order confirmation to show "${text}", but the page is not the order confirmation.`, hint: 'The name of a payment differs between the option ("Pay by bank wire") and the confirmation ("Bank transfer"): copy it from the page.' }));
});

// ---------------------------------------------------------------------------
// Customer account
// ---------------------------------------------------------------------------

/**
 * Assert that the order history of the customer lists the order placed
 * earlier in the scenario, optionally with a status.
 *
 * Example #1: Then my order history should list the placed order
 * Example #2: Then my order history should list the placed order as "Awaiting check payment"
 * Example #3: Then our order history should list the placed order as "Payment accepted"
 * Example #4: And my order history should list the placed order as "Canceled"
 * Example #5: Then our order history should list the placed order
 *
 */
Then(/^(my|our) order history should list the placed order(?: as "([^"]*)")?$/, async function (whose, status) {
  const reference = memory(this).orderReference;
  if (!reference) throw friendly({ message: 'No order was placed in this scenario.', hint: 'Place an order first ("I place the order").' });
  if ((await shopState(this)).page !== 'history') await open(this, shopPage(this, 'history'));
  // The history is a table by role only (div[role=table] with rows and cells), not a <table>.
  const rows = this.page.locator('[role="table"][aria-label="Order history"] [role="row"]');
  await waitUntil(this,
    async () => (await rows.allInnerTexts()).map(clean),
    (lines) => lines.some((line) => line.includes(reference) && (!status || line.includes(status))),
    (lines) => ({
      message: `Expected the order history to list the order ${reference}${status ? ` as "${status}"` : ''}. It lists: ${(lines || []).slice(1, 6).join(' | ') || 'no order'}.`,
      hint: 'Sign in as the customer who placed the order. The history is the page "Order history and details" of the account.',
    }));
});

/**
 * Open the details of the order placed earlier in the scenario from the
 * order history of the customer.
 *
 * Example #1: When I open the placed order in my order history
 * Example #2: When we open the placed order in our order history
 * Example #3: And I open the placed order in my order history
 * Example #4: Then I open the placed order in my order history
 * Example #5: When open the placed order in my order history
 *
 */
When(/^(I |we )*open the placed order in (?:my|our) order history$/, async function (pronounCase) {
  const reference = memory(this).orderReference;
  if (!reference) throw friendly({ message: 'No order was placed in this scenario.', hint: 'Place an order first ("I place the order").' });
  if ((await shopState(this)).page !== 'history') await open(this, shopPage(this, 'history'));
  const row = this.page.locator('[role="table"][aria-label="Order history"] [role="row"]').filter({ hasText: literal(reference) }).first();
  await actOrExplain('open in the order history the order', reference, () => row.locator('[data-link-action="view-order-details"]').first().click({ timeout: budget(this) }), 'Each row of the order history has the link "Details".');
  await settle(this);
});

/**
 * Assert that the address book of the customer shows, or does not show, an
 * address by its alias.
 *
 * Example #1: Then I should see the address "Home"
 * Example #2: Then I should not see the address "Office"
 * Example #3: Then we should see the address "Office"
 * Example #4: And I should not see the address "Webship office"
 * Example #5: Then I should see the address "My Address"
 *
 */
Then(/^(I |we )*should( not)* see the address "([^"]*)"$/, async function (pronounCase, notCase, alias) {
  const cards = this.page.locator('article[data-id-address]:visible');
  await assertPresence(cards.filter({ has: this.page.locator('.address-card__alias').filter({ hasText: exactly(alias) }) }), notCase, {
    label: `the address "${alias}"`,
    hint: 'Addresses are the cards of the page "Addresses" of the account (article[data-id-address]), each titled with its alias.',
    timeout: budget(this),
    found: async () => (await cards.allInnerTexts()).map((card) => clean(card).slice(0, 50)).join(' | ') || 'no address',
  });
});

/**
 * Make sure the address book of the signed-in customer holds no address with
 * the given alias: open the page "Addresses" and delete every one that has
 * it. For the start of a scenario that adds such an address, in case an
 * earlier run stopped before removing it.
 *
 * Example #1: Given I have no address "Office"
 * Example #2: Given we have no address "Office"
 * Example #3: And I have no address "Webship office"
 * Example #4: Given I have no address "Second home"
 * Example #5: Then I have no address "Office"
 *
 */
Given(/^(?:I|we) have no address "([^"]*)"$/, async function (alias) {
  await open(this, shopPage(this, 'addresses'));
  if ((await shopState(this)).page !== 'addresses') {
    throw friendly({ message: 'Could not open the address book: no customer is signed in.', hint: 'Sign in to the shop as a customer first.' });
  }
  for (let round = 0; round < 20; round += 1) {
    const card = this.page.locator('article[data-id-address]:visible').filter({ has: this.page.locator('.address-card__alias').filter({ hasText: exactly(alias) }) }).first();
    if (!(await card.count())) return;
    await card.locator('[data-link-action="delete-address"]').first().click({ timeout: budget(this) });
    await settle(this);
  }
  throw friendly({ message: `The address "${alias}" is still in the address book after 20 deletions.`, hint: 'An address used by an order in progress may be kept; check the page "Addresses" by hand.' });
});

/**
 * Edit or delete an address of the address book of the customer, by its
 * alias. Deleting is immediate: the shop asks for no confirmation.
 *
 * Example #1: When I delete the address "Office"
 * Example #2: When I edit the address "Home"
 * Example #3: When we delete the address "Webship office"
 * Example #4: And I edit the address "Office"
 * Example #5: When delete the address "Office"
 *
 */
When(/^(I |we )*(edit|delete) the address "([^"]*)"$/, async function (pronounCase, verb, alias) {
  const card = this.page.locator('article[data-id-address]:visible').filter({ has: this.page.locator('.address-card__alias').filter({ hasText: exactly(alias) }) }).first();
  await actOrExplain(`${verb} the address`, alias, () => card.locator(`[data-link-action="${verb}-address"]`).first().click({ timeout: budget(this) }), 'Each address card has the links "Edit" and "Delete" (data-link-action="edit-address" / "delete-address"). Open the page "Addresses" of the account first.');
  await settle(this);
});

/**
 * Fill in a field of the form of the page in the shop, by its label, inside
 * the main content: the address form, the registration form, the contact
 * form. (The checkout has its own step, which looks in the open checkout
 * step.)
 *
 * Example #1: When I fill in the shop field "Alias" with "Office"
 * Example #2: When I fill in the shop field "Message" with "Where is my order?"
 * Example #3: When we fill in the shop field "Email address" with "customer@example.com"
 * Example #4: And I fill in the shop field "Zip/Postal Code" with "33601"
 * Example #5: When I fill in the shop field "Password" with "Newcomer123456789!"
 *
 */
When(/^(I |we )*fill in the shop field "([^"]*)" with "([^"]*)"$/, async function (pronounCase, label, value) {
  const form = this.page.locator('#wrapper form:visible, main form:visible');
  const field = form.locator('input:not([type="hidden"]), textarea').and(this.page.getByLabel(label, { exact: true })).first();
  await actOrExplain('fill in the shop field', label, () => field.fill(value, { timeout: budget(this) }), 'Shop fields are found by their label inside the form of the main content (not the search box of the header).');
});

/**
 * Choose an option of a list field of the form of the page in the shop, by
 * its label ("State", "Country", "Subject").
 *
 * Example #1: When I select "Florida" for the shop field "State"
 * Example #2: When I select "Webmaster" for the shop field "Subject"
 * Example #3: When we select "United States" for the shop field "Country"
 * Example #4: And I select "Customer service" for the shop field "Subject"
 * Example #5: When select "Texas" for the shop field "State"
 *
 */
When(/^(I |we )*select "([^"]*)" for the shop field "([^"]*)"$/, async function (pronounCase, option, label) {
  const form = this.page.locator('#wrapper form:visible, main form:visible');
  await actOrExplain(`select "${option}" for the shop field`, label, () => form.getByRole('combobox', { name: label, exact: true }).first().selectOption({ label: option }, { timeout: budget(this) }), 'List fields are found by their label inside the form of the main content.');
});

/**
 * Tick a box of the form of the page in the shop, by the start of its label
 * (the consents of the registration form).
 *
 * Example #1: When I tick the shop box "Customer data privacy"
 * Example #2: When I tick the shop box "I agree to the terms and conditions and the privacy policy"
 * Example #3: When we tick the shop box "Sign up for our newsletter"
 * Example #4: And I tick the shop box "Receive offers from our partners"
 * Example #5: When tick the shop box "Customer data privacy"
 *
 */
When(/^(I |we )*tick the shop box "([^"]*)"$/, async function (pronounCase, label) {
  const form = this.page.locator('#wrapper form:visible, main form:visible');
  await actOrExplain('tick the shop box', label, () => form.getByRole('checkbox', { name: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().check({ timeout: budget(this) }), 'Boxes are found by the start of their label inside the form of the main content.');
});

/**
 * Send the form of the page in the shop with its own button ("Save" of an
 * address, "Create account" of the registration, "Send your message" of the
 * contact page) and wait for the answer.
 *
 * Example #1: When I send the shop form
 * Example #2: When we send the shop form
 * Example #3: And I send the shop form
 * Example #4: Then I send the shop form
 * Example #5: When send the shop form
 *
 */
When(/^(I |we )*send the shop form$/, async function (pronounCase) {
  const form = this.page.locator('#wrapper form:visible, main form:visible').filter({ has: this.page.locator('input:not([type="hidden"]):not([name="s"]):not([name="discount_name"]), textarea') }).first();
  await actOrExplain('send', 'the shop form', () => form.locator('button[type="submit"]:visible, input[type="submit"]:visible').last().click({ timeout: budget(this) }), 'The form of the main content is sent with its submit button.');
  await settle(this);
});
