'use strict';

// Back office step definitions for what the shop sells and what it sold: the
// product page (create, name, price, stock, category, image, online/offline,
// save, delete), the orders (open, status, history, note), the modules (search,
// enable, disable) and the clean-up steps that remove what a scenario created.
//
// The session, the menu, the lists, the dialogs, the messages and the generic
// form fields are in prestashop-back-office.steps.js.

const path = require('path');
const fs = require('fs');
const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  literal,
  clean,
  settle,
  actOrExplain,
  assertPresence,
  waitUntil,
  memory,
  menuLink,
  answerDialog,
  grid,
  gridRows,
  gridRow,
  gridRowAction,
} = require('./prestashop-helpers');

const PRODUCT_HINT = 'The product page is /sell/catalog/products/<id>/edit: the name is #product_header_name_1, the tabs are a[role=tab] in #form-nav, and "Save" (#product_footer_save) stays disabled until a field was changed and left.';

/** Fail early, with a clear message, when the page is not a product page. */
async function requireProductPage(world) {
  try {
    await world.page.locator('#product_header_name_1').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `Expected the product page, but the page is ${world.page.url().split('?')[0]}.`, hint: 'Open a product from the products list, or create one, before using a product step.' });
  }
}

/** Open a tab of the product page, when it is not the open one. */
async function openProductTab(world, title) {
  const tab = world.page.locator('#form-nav a[role="tab"]').filter({ hasText: new RegExp('^\\s*' + title + '\\s*$') }).first();
  if (!/\bactive\b/.test((await tab.getAttribute('class', { timeout: budget(world) })) || '')) await tab.click();
}

/** Fill a field of the product page and leave it, so the page notices the change. */
async function fillProductField(world, selector, value) {
  const field = world.page.locator(selector).first();
  await field.fill(String(value), { timeout: budget(world) });
  await field.blur();
}

/** The quantity the Stocks tab shows next to "Edit quantity". */
async function productStock(world) {
  const text = clean(await world.page.locator('#product_stock_quantities').innerText({ timeout: 2000 }));
  const found = text.match(/Edit quantity\s*(-?\d+)/);
  return found ? Number(found[1]) : NaN;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Create a product of a type from the products list: press "Add new product",
 * choose the type in the dialog (it is a page inside a frame) and confirm.
 * The back office creates the product at once, nameless and offline, and
 * opens its page: give it a name and save it, or delete it.
 *
 * Example #1: When I create a "standard" product
 * Example #2: When I create a "virtual" product
 * Example #3: When we create a "standard" product
 * Example #4: And I create a "combinations" product
 * Example #5: When I create a "pack" product
 *
 */
When(/^(I |we )*create a "(standard|combinations|pack|virtual)" product$/, async function (pronounCase, type) {
  const page = this.page;
  await actOrExplain('create a product of the type', type, async () => {
    await page.locator('#page-header-desc-configuration-add:visible').first().click({ timeout: budget(this) });
    const frame = page.frameLocator('#modal-create-product iframe');
    await frame.locator(`button.product-type-choice[data-value="${type}"]`).click({ timeout: budget(this) });
    await frame.locator('#create_product_create').click();
    await page.waitForURL(/\/products\/\d+\/edit/, { timeout: 30000 });
  }, 'Use this step on the products list (Catalog > Products). "Add new product" opens the dialog #modal-create-product, whose content is a frame with the four product types and the button "Add new product".');
  await settle(this);
  await requireProductPage(this);
});

/**
 * Set the name of the product on the product page.
 *
 * Example #1: When I set the product name to "Webship test mug"
 * Example #2: When we set the product name to "Webship bulk mug"
 * Example #3: And I set the product name to "Webship test mug, second edition"
 * Example #4: When I set the product name to "Webship offline product"
 * Example #5: When set the product name to "Webship test mug"
 *
 */
When(/^(I |we )*set the product name to "([^"]*)"$/, async function (pronounCase, name) {
  await requireProductPage(this);
  await actOrExplain('set the product name to', name, () => fillProductField(this, '#product_header_name_1', name), PRODUCT_HINT);
});

/**
 * Assert the name the product page shows.
 *
 * Example #1: Then the product name should be "Webship test mug"
 * Example #2: Then the product name should be "copy of Customizable mug"
 * Example #3: And the product name should be "Customizable mug"
 * Example #4: Then the product name should be "Webship bulk mug"
 * Example #5: Then the product name should be ""
 *
 */
Then(/^the product name should be "([^"]*)"$/, async function (name) {
  await requireProductPage(this);
  await waitUntil(this,
    () => this.page.locator('#product_header_name_1').inputValue({ timeout: 2000 }),
    (value) => value === name,
    (value) => ({ message: `Expected the product name "${name}", but the product page shows "${value}".`, hint: PRODUCT_HINT }));
});

/**
 * Set the retail price of the product, tax excluded (Pricing tab).
 *
 * Example #1: When I set the product price to "21.50"
 * Example #2: When I set the product price to "9.5"
 * Example #3: When we set the product price to "100"
 * Example #4: And I set the product price to "-5"
 * Example #5: When set the product price to "0"
 *
 */
When(/^(I |we )*set the product price to "([^"]*)"$/, async function (pronounCase, price) {
  await requireProductPage(this);
  await actOrExplain('set the product price to', price, async () => {
    await openProductTab(this, 'Pricing');
    await fillProductField(this, '#product_pricing_retail_price_price_tax_excluded', price);
  }, PRODUCT_HINT + ' The price is "Retail price (tax excl.)" on the Pricing tab.');
});

/**
 * Assert the retail price of the product, tax excluded, as a number: "21.5"
 * matches the "21.500000" the field shows.
 *
 * Example #1: Then the product price should be "21.50"
 * Example #2: Then the product price should be "13.9"
 * Example #3: And the product price should be "9.5"
 * Example #4: Then the product price should be "0"
 * Example #5: Then the product price should be "100"
 *
 */
Then(/^the product price should be "([^"]*)"$/, async function (price) {
  await requireProductPage(this);
  await waitUntil(this,
    () => this.page.locator('#product_pricing_retail_price_price_tax_excluded').inputValue({ timeout: 2000 }),
    (value) => Number(value) === Number(price),
    (value) => ({ message: `Expected the product price ${Number(price)} (tax excl.), but the product page shows "${value}".`, hint: 'The field shows six decimals ("21.500000"); letters typed in it become 0.' }));
});

/**
 * Add items to, or remove items from, the stock of the product (Stocks tab).
 * The product page has no quantity field: the quantity is changed by a
 * difference ("Add or subtract items") and each change is logged as a stock
 * movement when the product is saved.
 *
 * Example #1: When I add 5 items to the product stock
 * Example #2: When I remove 5 items from the product stock
 * Example #3: When we add 100 items to the product stock
 * Example #4: And I add 1 item to the product stock
 * Example #5: When I remove 1 item from the product stock
 *
 */
When(/^(I |we )*(add|remove) (\d+) items? (?:to|from) the product stock$/, async function (pronounCase, verb, count) {
  await requireProductPage(this);
  const delta = verb === 'add' ? Number(count) : -Number(count);
  await actOrExplain(`${verb} items of the product stock:`, count, async () => {
    await openProductTab(this, 'Stocks');
    await fillProductField(this, '#product_stock_quantities_delta_quantity_delta', delta);
  }, PRODUCT_HINT + ' The stock is on the Stocks tab: "Edit quantity <current>" and the field "Add or subtract items".');
});

/**
 * Assert the quantity in stock the product page shows (Stocks tab, "Edit
 * quantity"), as saved.
 *
 * Example #1: Then the product stock should be 305
 * Example #2: Then the product stock should be 300
 * Example #3: And the product stock should be 0
 * Example #4: Then the product stock should be 5
 * Example #5: Then the product stock should be 1200
 *
 */
Then(/^the product stock should be (-?\d+)$/, async function (expected) {
  await requireProductPage(this);
  await openProductTab(this, 'Stocks');
  await waitUntil(this,
    () => productStock(this),
    (quantity) => quantity === Number(expected),
    (quantity) => ({ message: `Expected the product stock to be ${expected}, but the Stocks tab shows ${Number.isNaN(quantity) ? 'no quantity' : quantity}.`, hint: 'A change of stock only counts once the product is saved; the tab then lists it under "Recent stock movements".' }));
});

/**
 * Set the reference of the product (Details tab).
 *
 * Example #1: When I set the product reference to "webship_1"
 * Example #2: When we set the product reference to "webship_2"
 * Example #3: And I set the product reference to "demo_99"
 * Example #4: When I set the product reference to ""
 * Example #5: When set the product reference to "webship_1"
 *
 */
When(/^(I |we )*set the product reference to "([^"]*)"$/, async function (pronounCase, reference) {
  await requireProductPage(this);
  await actOrExplain('set the product reference to', reference, async () => {
    await openProductTab(this, 'Details');
    await fillProductField(this, '#product_details_references_reference', reference);
  }, PRODUCT_HINT + ' The reference is the first field of the Details tab.');
});

/**
 * Add the product to a category: open "Choose categories" on the Description
 * tab, find the category with the search box of the dialog, and apply.
 *
 * Example #1: When I add the product to the category "Men"
 * Example #2: When I add the product to the category "Art"
 * Example #3: When we add the product to the category "Stationery"
 * Example #4: And I add the product to the category "Accessories"
 * Example #5: When add the product to the category "Women"
 *
 */
When(/^(I |we )*add the product to the category "([^"]*)"$/, async function (pronounCase, category) {
  await requireProductPage(this);
  const page = this.page;
  await actOrExplain('add the product to the category', category, async () => {
    await openProductTab(this, 'Description');
    await page.locator('#product_description_categories_add_categories_btn').click({ timeout: budget(this) });
    const box = page.locator('#categories-modal.show');
    await box.waitFor({ state: 'visible', timeout: budget(this) });
    await box.locator('#ps-select-product-category').pressSequentially(category, { delay: 40 });
    await page.locator('.tt-menu.tt-open .tt-suggestion').filter({ hasText: new RegExp('^\\s*' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first().click({ timeout: budget(this) });
    await box.locator('.pstaggerTag').filter({ hasText: literal(category) }).first().waitFor({ state: 'visible', timeout: budget(this) });
    await box.locator('.js-apply-categories-btn').click();
    await box.waitFor({ state: 'hidden', timeout: budget(this) });
  }, 'The dialog #categories-modal has a search box that suggests categories by name, a tree of checkboxes (children are folded) and the buttons "Cancel" and "Apply".');
});

/**
 * Assert that the product page lists, or does not list, a category among the
 * categories of the product (Description tab).
 *
 * Example #1: Then the product should be in the category "Men"
 * Example #2: Then the product should not be in the category "Art"
 * Example #3: And the product should be in the category "Home Accessories"
 * Example #4: Then the product should be in the category "Home"
 * Example #5: Then the product should not be in the category "Women"
 *
 */
Then(/^the product should( not)* be in the category "([^"]*)"$/, async function (notCase, category) {
  await requireProductPage(this);
  await openProductTab(this, 'Description');
  const tags = () => this.page.locator('#product_description_categories .pstaggerTag').evaluateAll((nodes) => nodes.map((node) => (node.querySelector('.category-name-preview') || node).textContent.replace(/\s+/g, ' ').trim()));
  await waitUntil(this, tags, (names) => names.includes(category) === !notCase, (names) => ({
    message: `Expected the product ${notCase ? 'not ' : ''}to be in the category "${category}". Its categories are: ${(names || []).join(', ') || '(none)'}.`,
    hint: 'The categories are the tags above the "Choose categories" button of the Description tab.',
  }));
});

/**
 * Upload an image of the product from the fixtures folder of the suite
 * (`tests/fixtures`), on the Description tab. The back office saves it at
 * once; the step waits until the image is stored.
 *
 * Example #1: When I upload the product image "product.png"
 * Example #2: When we upload the product image "product.png"
 * Example #3: And I upload the product image "product.png"
 * Example #4: When I upload the product image "tests/fixtures/product.png"
 * Example #5: When upload the product image "product.png"
 *
 */
When(/^(I |we )*upload the product image "([^"]*)"$/, async function (pronounCase, file) {
  await requireProductPage(this);
  const page = this.page;
  const candidates = [path.resolve(file), path.resolve('tests/fixtures', file), path.resolve(__dirname, '..', 'fixtures', file)];
  const source = candidates.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    throw friendly({ message: `The image "${file}" was not found. Looked in: ${candidates.join(', ')}.`, hint: 'Put the image in tests/fixtures of your project and name it by its file name.' });
  }
  await actOrExplain('upload the product image', file, async () => {
    await openProductTab(this, 'Description');
    const stored = () => page.locator('#product-images-dropzone .dz-preview.dz-complete').evaluateAll((nodes) => nodes.filter((node) => /^\d+$/.test(node.getAttribute('data-id') || '')).length);
    const before = await stored();
    // The file input of the drop zone is a hidden input on <body>.
    await page.locator('input.dz-hidden-input').setInputFiles(source);
    const deadline = Date.now() + 30000;
    while ((await stored()) <= before) {
      const failed = await page.locator('#product-images-dropzone .dz-preview.dz-error').count();
      if (failed) throw new Error('The back office refused the image: ' + clean(await page.locator('#product-images-dropzone .dz-error').first().innerText().catch(() => '')));
      if (Date.now() > deadline) throw new Error('The image was not stored within 30 seconds.');
      await page.waitForTimeout(200);
    }
  }, 'The images are in the drop zone #product-images-dropzone of the Description tab (JPG, GIF, PNG or WebP). A stored image is a .dz-preview.dz-complete with a numeric data-id.');
});

/**
 * Assert how many images the product has (Description tab).
 *
 * Example #1: Then the product should have 1 image
 * Example #2: Then the product should have 2 images
 * Example #3: And the product should have 0 images
 * Example #4: Then the product should have 3 images
 * Example #5: Then the product should have 1 images
 *
 */
Then(/^the product should have (\d+) images?$/, async function (count) {
  await requireProductPage(this);
  await openProductTab(this, 'Description');
  await waitUntil(this,
    () => this.page.locator('#product-images-dropzone .dz-preview.dz-complete').evaluateAll((nodes) => nodes.filter((node) => /^\d+$/.test(node.getAttribute('data-id') || '')).length),
    (images) => images === Number(count),
    (images) => ({ message: `Expected the product to have ${count} image(s), but it has ${images}.`, hint: 'Images are counted in the drop zone of the Description tab once they are stored.' }));
});

/**
 * Put the product online (visible in the shop) or offline, with the switch at
 * the top of the product page. Save the product afterwards.
 *
 * Example #1: When I put the product online
 * Example #2: When I put the product offline
 * Example #3: When we put the product online
 * Example #4: And I put the product offline
 * Example #5: When put the product online
 *
 */
When(/^(I |we )*put the product (online|offline)$/, async function (pronounCase, state) {
  await requireProductPage(this);
  const wanted = state === 'online';
  await actOrExplain('put the product', state, async () => {
    const radio = this.page.locator('#product_header_active_1');
    if ((await radio.isChecked({ timeout: budget(this) })) === wanted) return;
    // The radios and their labels sit under the sliding button: press the switch itself, as a person does.
    await this.page.locator('#product_header_active').click({ timeout: budget(this) });
    await this.page.waitForFunction((on) => document.getElementById('product_header_active_1').checked === on, wanted, { timeout: budget(this) });
  }, PRODUCT_HINT + ' The switch is span#product_header_active.ps-switch with two radios, #product_header_active_1 "Online" and #product_header_active_0 "Offline".');
});

/**
 * Assert whether the product page shows the product as online or offline.
 *
 * Example #1: Then the product should be online
 * Example #2: Then the product should be offline
 * Example #3: And the product should be online
 * Example #4: But the product should be offline
 * Example #5: Then the product should be online
 *
 */
Then(/^the product should be (online|offline)$/, async function (state) {
  await requireProductPage(this);
  await waitUntil(this,
    () => this.page.locator('#product_header_active_1').isChecked({ timeout: 2000 }),
    (online) => online === (state === 'online'),
    (online) => ({ message: `Expected the product to be ${state}, but the product page shows it as ${online ? 'online' : 'offline'}.`, hint: 'A new product and a duplicate start offline.' }));
});

/**
 * Save the product ("Save") and wait for the product page to load again with
 * the answer of the back office. Fails with a clear message when "Save" is
 * disabled because nothing was changed.
 *
 * Example #1: When I save the product
 * Example #2: When we save the product
 * Example #3: And I save the product
 * Example #4: Then I save the product
 * Example #5: When save the product
 *
 */
When(/^(I |we )*save the product$/, async function (pronounCase) {
  await requireProductPage(this);
  const page = this.page;
  const save = page.locator('#product_footer_save');
  await page.waitForFunction(() => !document.querySelector('#product_footer_save').disabled, null, { timeout: 5000 }).catch(() => {});
  if (await save.isDisabled()) {
    throw friendly({ message: 'Could not save the product: the "Save" button is disabled.', hint: 'The product page turns "Save" on when a field was changed and left. Change a field with a product step first.' });
  }
  await save.click();
  await settle(this);
  await page.locator('.alert-success:visible, .alert-danger:visible').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
});

/**
 * Start deleting the product from its page (the menu next to "Go to catalog",
 * "Delete"). The back office asks for a confirmation in a dialog; after it,
 * the products list is shown.
 *
 * Example #1: When I delete the product from its page
 * Example #2: When we delete the product from its page
 * Example #3: And I delete the product from its page
 * Example #4: Then I delete the product from its page
 * Example #5: When delete the product from its page
 *
 */
When(/^(I |we )*delete the product from its page$/, async function (pronounCase) {
  await requireProductPage(this);
  await actOrExplain('delete', 'the product', async () => {
    await this.page.locator('#product_footer_actions_dropdown').click({ timeout: budget(this) });
    await this.page.locator('#product_footer_actions_delete').click({ timeout: budget(this) });
    await this.page.locator('#delete-product-footer-modal.show').waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The footer of the product page has "Go to catalog" and a menu (three dots) with "New product", "Delete" and "Duplicate".');
});

/**
 * Leave the product page for the products list ("Go to catalog").
 *
 * Example #1: When I go back to the catalog
 * Example #2: When we go back to the catalog
 * Example #3: And I go back to the catalog
 * Example #4: Then I go back to the catalog
 * Example #5: When go back to the catalog
 *
 */
When(/^(I |we )*go back to the catalog$/, async function (pronounCase) {
  await requireProductPage(this);
  await this.page.locator('#product_footer_actions_catalog').click({ timeout: budget(this) });
  await settle(this);
});

// ---------------------------------------------------------------------------
// Clean-up: what a scenario created, it removes
// ---------------------------------------------------------------------------

/**
 * Delete every record of a list of the back office whose row shows the given
 * text, and confirm each dialog: the clean-up of a scenario. Use it at the
 * start (a failed run may have left records) and at the end. It opens the
 * list from the menu, resets its filters, reads its first page and passes
 * when there is nothing to delete. Works for products, categories, customers,
 * cart rules and customer service threads. A product that was created but
 * never saved with a name is listed as "N/A".
 *
 * Example #1: Given no "Webship test mug" is left in "Catalog > Products"
 * Example #2: Given no "Webship test category" is left in "Catalog > Categories"
 * Example #3: Then no "newcomer@example.com" is left in "Customers > Customers"
 * Example #4: And no "Webship ten percent" is left in "Catalog > Discounts"
 * Example #5: Then no "Webship test message" is left in "Customer Service > Customer Service"
 * Example #6: Given no "N/A" is left in "Catalog > Products"
 *
 */
Given(/^no "([^"]*)" is left in "([^"]*)"$/, async function (text, menuPath) {
  const page = this.page;
  const openList = async () => {
    const link = await menuLink(this, menuPath);
    await page.goto(new URL(await link.getAttribute('href'), page.url()).href);
    await settle(this);
    const reset = page.locator('.js-reset-search:visible').first();
    if (await reset.count()) {
      await reset.click();
      await reset.waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
      await settle(this);
    }
  };
  await openList();
  for (let round = 0; round < 25; round += 1) {
    const table = await grid(this);
    const row = gridRows(table).filter({ hasText: literal(text) }).first();
    if (!(await row.count())) return;
    const action = await gridRowAction(this, row, 'Delete');
    await action.click({ timeout: budget(this) });
    await answerDialog(this, true);
    await page.locator('.alert-success:visible, .alert-danger:visible').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
    const refused = await page.locator('.alert-danger:visible').first().innerText().catch(() => '');
    if (refused) throw friendly({ message: `Could not delete "${text}" in "${menuPath}": ${clean(refused)}`, hint: 'Delete it by hand in the back office and read what blocks it.' });
  }
  throw friendly({ message: `"${text}" is still listed in "${menuPath}" after 25 deletions.`, hint: 'The text matches too many records, or the list does not delete them. Check the list by hand.' });
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const ORDER_HINT = 'The order page is /sell/orders/<id>/view: the status select is #update_order_status_action_input with the button "Update status", the history is the tab "Status".';

async function requireOrderPage(world) {
  try {
    await world.page.locator('#update_order_status_action_input').first().waitFor({ state: 'attached', timeout: budget(world) });
  } catch {
    throw friendly({ message: `Expected the page of an order, but the page is ${world.page.url().split('?')[0]}.`, hint: 'Open an order from Orders > Orders before using an order step.' });
  }
}

/**
 * Open the page of the order that was placed in the shop earlier in the
 * scenario (the step "I place the order" remembers its reference), from the
 * orders list of the back office.
 *
 * Example #1: When I open the placed order in the back office
 * Example #2: When we open the placed order in the back office
 * Example #3: And I open the placed order in the back office
 * Example #4: Then I open the placed order in the back office
 * Example #5: When open the placed order in the back office
 *
 */
When(/^(I |we )*open the placed order in the back office$/, async function (pronounCase) {
  const reference = memory(this).orderReference;
  if (!reference) throw friendly({ message: 'No order was placed in this scenario, so there is no placed order to open.', hint: 'Place an order in the shop first ("I place the order"): the step remembers its reference.' });
  const link = await menuLink(this, 'Orders > Orders');
  await this.page.goto(new URL(await link.getAttribute('href'), this.page.url()).href);
  await settle(this);
  const row = await gridRow(this, reference);
  // A paid order has a second icon in its row (the invoice, a download): take the view link.
  await row.locator('td.column-actions a.grid-view-row-link').first().click({ timeout: budget(this) });
  await settle(this);
  await requireOrderPage(this);
});

/**
 * Assert that the list of the page (the orders list) shows the order that was
 * placed in the shop earlier in the scenario, by its reference.
 *
 * Example #1: Then I should see the placed order in the list
 * Example #2: Then we should see the placed order in the list
 * Example #3: And I should see the placed order in the list
 * Example #4: Then I should not see the placed order in the list
 * Example #5: Then should see the placed order in the list
 *
 */
Then(/^(I |we )*should( not)* see the placed order in the list$/, async function (pronounCase, notCase) {
  const reference = memory(this).orderReference;
  if (!reference) throw friendly({ message: 'No order was placed in this scenario.', hint: 'Place an order in the shop first ("I place the order").' });
  const table = await grid(this);
  await assertPresence(gridRows(table).filter({ hasText: literal(reference) }), notCase, {
    label: `the order ${reference} in the list`,
    hint: 'Open Orders > Orders and reset its filters: the newest order is the first row.',
    timeout: budget(this),
    found: async () => (await gridRows(table).evaluateAll((rows) => rows.slice(0, 4).map((row) => row.innerText.replace(/\s+/g, ' ').trim().slice(0, 60)))).join(' | ') || 'an empty list',
  });
});

/**
 * Assert the title of the order page: its number, reference and customer,
 * for example "Order #5 KHWLILZLL from John DOE". The text may be a part.
 *
 * Example #1: Then the order page should be titled "KHWLILZLL from John DOE"
 * Example #2: Then the order page should be titled "Order #5"
 * Example #3: And the order page should be titled "from Clara Customer"
 * Example #4: Then the order page should be titled "from Greta Guest"
 * Example #5: Then the order page should be titled "Order #"
 *
 */
Then(/^the order page should be titled "([^"]*)"$/, async function (text) {
  await requireOrderPage(this);
  await waitUntil(this,
    async () => clean(await this.page.locator('h1:visible').first().innerText({ timeout: 2000 })),
    (title) => title.includes(text),
    (title) => ({ message: `Expected the order page to be titled "${text}", but its title is "${title}".`, hint: 'The title reads "Order #<id> <reference> from <first name> <last name>".' }));
});

/**
 * Change the status of the order on its page: choose the status and press
 * "Update status". The back office adds a line to the history of the order.
 *
 * Example #1: When I change the order status to "Payment accepted"
 * Example #2: When I change the order status to "Canceled"
 * Example #3: When we change the order status to "Shipped"
 * Example #4: And I change the order status to "Processing in progress"
 * Example #5: When I change the order status to "Awaiting check payment"
 *
 */
When(/^(I |we )*change the order status to "([^"]*)"$/, async function (pronounCase, status) {
  await requireOrderPage(this);
  const page = this.page;
  const select = page.locator('#update_order_status_action_input');
  const current = clean(await select.locator('option:checked').innerText());
  if (current === status) {
    throw friendly({ message: `The order already has the status "${status}".`, hint: 'The button "Update status" stays disabled until another status is chosen.' });
  }
  await actOrExplain('change the order status to', status, async () => {
    await select.selectOption({ label: status });
    await page.locator('#update_order_status_action_btn').click({ timeout: budget(this) });
  }, ORDER_HINT + ' Statuses: ' + (await select.locator('option').allInnerTexts()).map(clean).join(', ') + '.');
  await settle(this);
});

/**
 * Assert the current status of the order, as its page shows it.
 *
 * Example #1: Then the order status should be "Payment accepted"
 * Example #2: Then the order status should be "Awaiting bank wire payment"
 * Example #3: And the order status should be "Awaiting check payment"
 * Example #4: Then the order status should be "Canceled"
 * Example #5: Then the order status should be "Awaiting Cash On Delivery validation"
 *
 */
Then(/^the order status should be "([^"]*)"$/, async function (status) {
  await requireOrderPage(this);
  await waitUntil(this,
    async () => clean(await this.page.locator('#update_order_status_action_input option:checked').innerText({ timeout: 2000 })),
    (current) => current === status,
    (current) => ({ message: `Expected the order status "${status}", but the order has the status "${current}".`, hint: ORDER_HINT }));
});

/**
 * Assert the newest line of the status history of the order: the status and,
 * optionally, the employee who set it (empty when the shop set it).
 *
 * Example #1: Then the latest order history entry should be "Payment accepted"
 * Example #2: Then the latest order history entry should be "Payment accepted" by "Shop Admin"
 * Example #3: And the latest order history entry should be "Awaiting check payment"
 * Example #4: Then the latest order history entry should be "Canceled" by "Shop Admin"
 * Example #5: Then the latest order history entry should be "Awaiting bank wire payment" by ""
 *
 */
Then(/^the latest order history entry should be "([^"]*)"(?: by "([^"]*)")?$/, async function (status, employee) {
  await requireOrderPage(this);
  const row = this.page.locator('#historyTabContent table tbody tr').first();
  const read = async () => ({
    status: clean(await row.locator('td[data-role="status-column"]').textContent({ timeout: 2000 })),
    employee: clean(await row.locator('td[data-role="employee-column"]').textContent({ timeout: 2000 })),
  });
  await waitUntil(this, read,
    (entry) => entry.status === status && (employee === undefined || employee === null || entry.employee === employee),
    (entry) => ({
      message: `Expected the latest history entry "${status}"${employee !== undefined && employee !== null ? ` by "${employee}"` : ''}, but it is "${entry ? entry.status : '(none)'}" by "${entry ? entry.employee : ''}".`,
      hint: 'The history is the table of the tab "Status" on the order page, newest first; the employee is empty for the status the shop gave at the order.',
    }));
});

/**
 * Assert how many lines the status history of the order has.
 *
 * Example #1: Then the order history should have 2 entries
 * Example #2: Then the order history should have 1 entry
 * Example #3: And the order history should have 3 entries
 * Example #4: Then the order history should have 4 entries
 * Example #5: Then the order history should have 1 entries
 *
 */
Then(/^the order history should have (\d+) entr(?:y|ies)$/, async function (count) {
  await requireOrderPage(this);
  await waitUntil(this,
    () => this.page.locator('#historyTabContent table tbody tr').count(),
    (lines) => lines === Number(count),
    (lines) => ({ message: `Expected the order history to have ${count} entr${Number(count) === 1 ? 'y' : 'ies'}, but it has ${lines}.`, hint: 'Each status change adds a line; the tab title counts them ("Status (2)").' }));
});

/**
 * Write the private note of the order ("Order private note") and save it. An
 * empty text removes the note.
 *
 * Example #1: When I set the order note to "Call the customer before shipping"
 * Example #2: When we set the order note to "Gift wrap"
 * Example #3: And I set the order note to ""
 * Example #4: When I set the order note to "Checked by the Webship suite"
 * Example #5: When set the order note to "Fragile"
 *
 */
When(/^(I |we )*set the order note to "([^"]*)"$/, async function (pronounCase, note) {
  await requireOrderPage(this);
  const page = this.page;
  await actOrExplain('set the order note to', note, async () => {
    const field = page.locator('#internal_note_note');
    if (!(await field.isVisible())) await page.locator('.js-order-notes-toggle-btn').click({ timeout: budget(this) });
    await field.fill(note, { timeout: budget(this) });
    // "Save" turns on when the text changes under the keys.
    await field.press('Space');
    await field.press('Backspace');
    await page.locator('.js-order-notes-btn').click({ timeout: budget(this) });
  }, 'The note is the block "Order private note" of the order page: a toggle (.js-order-notes-toggle-btn), the textarea #internal_note_note and "Save".');
  await settle(this);
});

/**
 * Assert the private note of the order.
 *
 * Example #1: Then the order note should be "Call the customer before shipping"
 * Example #2: Then the order note should be ""
 * Example #3: And the order note should be "Gift wrap"
 * Example #4: Then the order note should be "Checked by the Webship suite"
 * Example #5: Then the order note should be "Fragile"
 *
 */
Then(/^the order note should be "([^"]*)"$/, async function (note) {
  await requireOrderPage(this);
  await waitUntil(this,
    () => this.page.locator('#internal_note_note').inputValue({ timeout: 2000 }),
    (value) => value === note,
    (value) => ({ message: `Expected the order note "${note}", but it is "${value}".`, hint: 'The note is saved with its own "Save" button and answers "Update successful".' }));
});

/**
 * Assert that the order page lists a product among the products of the order.
 *
 * Example #1: Then the order should contain the product "Mug The best is yet to come"
 * Example #2: Then the order should contain the product "Mug The adventure begins"
 * Example #3: And the order should contain the product "Hummingbird printed t-shirt"
 * Example #4: Then the order should not contain the product "Customizable mug"
 * Example #5: Then the order should contain the product "demo_11"
 *
 */
Then(/^the order should( not)* contain the product "([^"]*)"$/, async function (notCase, product) {
  await requireOrderPage(this);
  await assertPresence(this.page.locator('#orderProductsTable tbody tr:visible, #orderProductsPanel table tbody tr:visible').filter({ hasText: literal(product) }), notCase, {
    label: `the product "${product}" in the order`,
    hint: 'The products are the table of the card "Products" on the order page.',
    timeout: budget(this),
    found: async () => clean(await this.page.locator('#orderProductsPanel').innerText().catch(() => '')).slice(0, 200),
  });
});

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

const MODULE_HINT = 'The Module manager shows each module as a card .module-item with data-name (its title), data-tech-name and data-active ("1" or "0").';

/** The card of a module by its title or its technical name. */
async function moduleCard(world, name) {
  const card = world.page.locator(`.module-item[data-name="${name}"], .module-item[data-tech-name="${name}"]`).first();
  try {
    await card.waitFor({ state: 'attached', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The Module manager lists no module "${name}".`, hint: MODULE_HINT + ' Open Modules > Module Manager first and write the title as the card shows it ("Banner"), or the technical name ("ps_banner").' });
  }
  return card;
}

/**
 * Search the Module manager for a word: the list then shows only the cards
 * that match.
 *
 * Example #1: When I search the modules for "Banner"
 * Example #2: When we search the modules for "Wire payment"
 * Example #3: And I search the modules for "newsletter"
 * Example #4: When I search the modules for "ps_banner"
 * Example #5: When search the modules for "Search bar"
 *
 */
When(/^(I |we )*search the modules for "([^"]*)"$/, async function (pronounCase, word) {
  const page = this.page;
  await actOrExplain('search the modules for', word, async () => {
    await page.locator('.pstaggerAddTagInput:visible').first().fill(word, { timeout: budget(this) });
    await page.locator('#module-search-button').click();
    await page.locator('.pstaggerTag').filter({ hasText: literal(word) }).first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The search of the Module manager is the box at the top of Modules > Module Manager with the button #module-search-button; each search word becomes a tag.');
});

/**
 * Assert that the Module manager shows, or does not show, the card of a
 * module (after a search, only the matching cards are shown).
 *
 * Example #1: Then I should see the module "Banner"
 * Example #2: Then I should not see the module "Search bar"
 * Example #3: Then we should see the module "ps_banner"
 * Example #4: And I should not see the module "Contact form"
 * Example #5: Then I should see the module "Wire payment"
 *
 */
Then(/^(I |we )*should( not)* see the module "([^"]*)"$/, async function (pronounCase, notCase, name) {
  await assertPresence(this.page.locator(`.module-item[data-name="${name}"]:visible, .module-item[data-tech-name="${name}"]:visible`), notCase, {
    label: `the module "${name}"`,
    hint: MODULE_HINT,
    timeout: budget(this),
    found: async () => (await this.page.locator('.module-item:visible').evaluateAll((cards) => cards.slice(0, 8).map((card) => card.getAttribute('data-name')))).join(', ') || 'no module card',
  });
});

/**
 * Enable or disable an installed module in the Module manager, confirm the
 * dialog a disable asks for, and wait until the card shows the new state.
 * (After a disable the back office can leave a dimmed page behind its closed
 * dialog; the step reloads the Module manager then, as a person has to.)
 *
 * Example #1: When I disable the module "Banner"
 * Example #2: When I enable the module "Banner"
 * Example #3: When we disable the module "ps_banner"
 * Example #4: And I enable the module "ps_banner"
 * Example #5: When disable the module "Banner"
 *
 */
When(/^(I |we )*(enable|disable) the module "([^"]*)"$/, async function (pronounCase, verb, name) {
  const page = this.page;
  const card = await moduleCard(this, name);
  const tech = await card.getAttribute('data-tech-name');
  const wanted = verb === 'enable' ? '1' : '0';
  if ((await card.getAttribute('data-installed')) !== '1') {
    throw friendly({ message: `The module "${name}" is not installed, so it cannot be ${verb}d.`, hint: 'Only installed modules have "Enable" and "Disable"; the others show "Install".' });
  }
  if ((await card.getAttribute('data-active')) === wanted) {
    throw friendly({ message: `The module "${name}" is already ${verb}d.`, hint: 'Assert its state first, or use the other verb.' });
  }
  await actOrExplain(`${verb} the module`, name, async () => {
    const button = card.locator(`.module_action_menu_${verb}`).first();
    if (!(await button.isVisible())) await card.locator('.module-actions .dropdown-toggle').first().click({ timeout: budget(this) });
    await button.click({ timeout: budget(this) });
    const confirm = page.locator(`#module-modal-confirm-${tech}-${verb}.show .module_action_modal_${verb}`);
    await confirm.waitFor({ state: 'visible', timeout: 3000 }).then(() => confirm.click()).catch(() => {});
    await page.waitForFunction(([technical, state]) => {
      const node = document.querySelector(`.module-item[data-tech-name="${technical}"]`);
      return node && node.getAttribute('data-active') === state;
    }, [tech, wanted], { timeout: 30000 });
  }, MODULE_HINT + ' "Enable" is a button of the card; "Disable" is in the menu next to "Configure" and asks "Disable module?".');
  await page.waitForTimeout(500);
  const stuck = await page.evaluate(() => document.querySelectorAll('.modal-backdrop').length > 0 && !document.querySelector('.modal.show'));
  if (stuck) {
    await page.reload();
    await settle(this);
  }
});

/**
 * Assert whether an installed module is enabled or disabled, as its card in
 * the Module manager says.
 *
 * Example #1: Then the module "Banner" should be enabled
 * Example #2: Then the module "Banner" should be disabled
 * Example #3: And the module "ps_banner" should be enabled
 * Example #4: Then the module "Wire payment" should be enabled
 * Example #5: Then the module "ps_banner" should be disabled
 *
 */
Then(/^the module "([^"]*)" should be (enabled|disabled)$/, async function (name, state) {
  const card = await moduleCard(this, name);
  await waitUntil(this,
    () => card.getAttribute('data-active', { timeout: 2000 }),
    (active) => active === (state === 'enabled' ? '1' : '0'),
    (active) => ({ message: `Expected the module "${name}" to be ${state}, but its card says it is ${active === '1' ? 'enabled' : 'disabled'}.`, hint: MODULE_HINT }));
});
