<p align="center"><img src="https://raw.githubusercontent.com/webship/prestashop-steps/2.0.x/assets/logo.svg" alt="PrestaShop logo" width="96"></p>

# @webship-js/prestashop-steps

Cucumber step definitions for testing PrestaShop shops with [webship-js](https://github.com/webship/webship-js)
(Playwright and Cucumber): the back office and the shop, in plain sentences.

```gherkin
Scenario: A customer pays by check and the employee accepts the payment
  Given I am signed in to the shop as "customer"
  And I am on "/index.php?id_product=7&controller=product"
  When I add the product to the cart
  And I proceed to checkout from the cart dialog
  And I proceed to checkout
  And I continue the checkout
  And I continue the checkout
  And I choose the payment method "Pay by Check"
  And I accept the terms of service
  And I place the order
  Then the order should be confirmed
  Given I am logged in to the back office as "admin"
  When I open the placed order in the back office
  And I change the order status to "Payment accepted"
  Then I should see the success message "Successful update"
  And my order history should list the placed order as "Payment accepted"
```

Every step was written from the real pages of a real install (PrestaShop 9.2.1, default theme) opened in a browser, and
the whole suite of this repository runs against such an install on every push, twice in a row.

## Install

```bash
npm install --save-dev webship-js @webship-js/prestashop-steps
npx playwright install chromium
```

Load the steps after the webship-js ones in your `cucumber.js`:

```js
require: [
  'node_modules/webship-js/tests/step-definitions/**/*.js',
  'node_modules/@webship-js/prestashop-steps/tests/step-definitions/**/*.js',
  'tests/step-definitions/**/*.js',
],
```

and tell the steps where the shop is and which accounts they may use (`worldParameters`):

```js
worldParameters: {
  launchUrl: process.env.LAUNCH_URL || 'https://my-shop.ddev.site',
  // The back office lives in a folder with a random name on a default install.
  backOffice: { folder: process.env.ADMIN_FOLDER || 'admin-steps' },
  employees: {
    admin: { email: 'admin@example.com', password: process.env.SHOP_ADMIN_PASSWORD, name: 'Shop Admin' },
    salesman: { email: 'salesman@example.com', password: process.env.SHOP_SALESMAN_PASSWORD, name: 'Sam Salesman' },
  },
  customers: {
    customer: { email: 'customer@example.com', password: process.env.SHOP_CUSTOMER_PASSWORD, name: 'Clara Customer' },
  },
}
```

The complete `cucumber.js` of this repository is a working example.

### Accounts are configuration

`I am logged in to the back office as "admin"` and `I am signed in to the shop as "customer"` take a handle of those
registries. The accounts are created once when the test shop is built
([`.github/scripts/provision-accounts.php`](.github/scripts/provision-accounts.php) creates the employee and the customers
without the browser); no step creates or deletes an employee. Never point the suite at a shop with real customers: it
places orders.

## Test users

The accounts this repository's suite signs in with, exactly as `cucumber.js` lists them in `worldParameters.employees`
and `worldParameters.customers` (the default values; `SHOP_<HANDLE>_EMAIL` and `SHOP_<HANDLE>_PASSWORD` replace them,
for example `SHOP_ADMIN_PASSWORD`). [`.github/scripts/build-ddev-prestashop.sh`](.github/scripts/build-ddev-prestashop.sh)
creates them on the local test shop, and CI does the same on the runner: the installer creates `admin` (SuperAdmin),
[`.github/scripts/provision-accounts.php`](.github/scripts/provision-accounts.php) the three others. They are
placeholder credentials of that throwaway shop, not of any real one.

```json
{
  "employees": {
    "admin": { "email": "admin@example.com", "password": "Admin123456789!", "name": "Shop Admin" },
    "salesman": { "email": "salesman@example.com", "password": "Salesman123456789!", "name": "Sam Salesman" }
  },
  "customers": {
    "customer": { "email": "customer@example.com", "password": "Customer123456789!", "name": "Clara Customer" },
    "shopper": { "email": "shopper@example.com", "password": "Shopper123456789!", "name": "Simon Shopper" }
  }
}
```

## What you need to know about the platform

These are the things the steps handle for you, found while exploring a real shop:

- **The security token.** A back-office address without `_token` does not open: it shows the "Invalid token" page. The
  steps follow the links of the main menu (`I open "Catalog > Products" in the back office menu`) or add the token of the
  session (`I open the back office path "improve/modules/manage"`).
- **Two page generations.** New pages (`/sell/…`, `/improve/…`) and legacy pages (`index.php?controller=Admin…`, such as
  Discounts and Customer Service) render the header, the lists, the dialogs and the messages differently. The same steps
  work on both.
- **Three kinds of confirmation dialogs.** `I confirm the dialog` and `I cancel the dialog` answer whichever is open.
- **Messages differ by one word.** "Successful update" after a status change, "Update successful" after a note. Copy the
  text from the page.
- **The product page.** "Add new product" opens a frame inside a dialog and creates the product at once; "Save" stays
  disabled until a field was changed and left; the stock is changed by a difference, not set.
- **The shop tells who is signed in and what the cart holds** through its `prestashop` object. The session, page kind
  and cart count steps read it; the other shop steps use roles, labels and the hooks of the default theme (Hummingbird).

## Steps

<!-- steps:start -->
141 steps in three files. The sentence shown is the first of the five examples of each step; "I" may be "we".

### The back office: session, menu, lists, dialogs, forms — `prestashop-back-office.steps.js` (45 steps)

| Step (first example) | What it does |
|---|---|
| `Given I am logged in to the back office as "admin"` | Log in to the back office as an employee of the registry (`worldParameters.employees` in cucumber.js), by its handle. |
| `When I log in to the back office with "admin@example.com" and "wrong-password"` | Send the sign-in form of the back office with an e-mail address and a password, without expecting it to succeed. |
| `When I log out of the back office` | Log out of the back office through the employee menu of the header, the way a person does. |
| `Then I should be logged in to the back office` | Assert that an employee session is open (the header shows the employee menu with "Sign out") or that it is not (the sign-in form is shown instead). |
| `Then the back office should greet "Shop"` | Assert the first name the employee menu greets ("Welcome back Shop"). |
| `When I open "Catalog > Products" in the back office menu` | Open a page from the main menu of the back office, by the labels a person reads. |
| `Then I should see "Modules" in the back office menu` | Assert that the main menu shows, or does not show, an entry or an item to the employee. |
| `Then the current back office menu item should be "Products"` | Assert which item of the main menu is the current one, by its label. |
| `Then the back office page title should be "Products"` | Assert the title of the back-office page (its h1). |
| `Then the back office breadcrumb should be "Catalog > Products"` | Assert the breadcrumb of the back-office page, written with " > " between its parts. |
| `When I press the back office toolbar button "Add new category"` | Press a button of the toolbar at the top right of a back-office page, by its label. |
| `When I open the back office path "improve/modules/manage"` | Open a back-office address by its path after the back-office folder, with the security token of the session (read from the menu links). |
| `When I open the back office path "sell/catalog/products/" without the security token` | Open a back-office address without the security token, as a pasted or bookmarked link would. |
| `Then I should see the invalid security token page` | Assert that the back office shows its "Invalid token" page, which asks whether to display a page opened without the security token. |
| `Then I should see the access denied page` | Assert that the back office refused the page to the employee. |
| `Then I should see the success message "Successful update"` | Assert a message of the page by its type and text. |
| `Then I should not see any error message` | Assert that the page shows no message of a type at all, for example no error after saving. |
| `Then I should see the notification "The status has been successfully updated."` | Assert the notification that slides in at the top right of the back office after an action that does not reload the page (a row switch, a module). |
| `Then I should see the field error "The field name is required at least in your default language."` | Assert the error a form shows under one of its fields, in the back office (a red line under the field) or in the shop. |
| `Then I should see the confirmation dialog "Duplicate product"` | Assert that a confirmation dialog is open and that its title or its text contains the given words. |
| `When I confirm the dialog` | Confirm the open dialog. |
| `When I cancel the dialog` | Cancel the open dialog. |
| `Then I should not see a confirmation dialog` | Assert that no confirmation dialog is open (any more). |
| `When I filter the list by "Name" with "mug"` | Filter the list of the page by one of its columns. |
| `When I reset the list filters` | Reset the filters of the list ("Reset"), so it shows every record again. |
| `Then the list should have 5 rows` | Assert how many records the list shows on this page. |
| `Then I should see "Customizable mug" in the list` | Assert that the list shows, or does not show, a row containing the text. |
| `Then the first row of the list should contain "Customizable mug"` | Assert that the first row of the list contains the text. |
| `Then the "Quantity" of the list row "Customizable mug" should be "300"` | Assert the content of one cell. |
| `When I open the list row "Customizable mug"` | Open a record from the list by the main action of its row. |
| `When I choose "Duplicate" for the list row "Customizable mug"` | Choose an action of a list row by its name. |
| `When I select the list row "Webship bulk mug"` | Tick the checkbox of a list row, to act on it with a bulk action. |
| `When I choose the bulk action "Delete selection"` | Choose a bulk action for the selected rows from the "Bulk actions" menu, which is disabled until a row is selected. |
| `When I wait for the bulk action to finish` | Wait for a bulk action of the products list to finish. |
| `When I flip the "Status" switch of the list row "Webship bulk mug"` | Flip the switch a list row shows in a column (the "Status" of a product, the "Displayed" of a category, the "Enabled" of a customer). |
| `Then the "Status" switch of the list row "Webship bulk mug" should be on` | Assert whether the switch a list row shows in a column is on or off. |
| `When I sort the list by "Name" in ascending order` | Sort the list by a column, in ascending or descending order, with the sort control of its title. |
| `When I show 10 rows per page in the list` | Choose how many records the list shows per page ("Items per page"). |
| `When I go to the next page of the list` | Go to the next or to the previous page of the list. |
| `Then the list pagination should read "Viewing 1-10 out of 19 (page 1 / 2)"` | Assert what the pagination of the list reads, for example "Viewing 1-10 out of 19 (page 1 / 2)". |
| `When I fill in the back office field "Name" with "Webship test category"` | Fill in a field of a back-office form, found by the label a person reads next to it. |
| `Then the back office field "Name" should contain "Webship test category"` | Assert the value of a field of a back-office form, found by its label. |
| `When I choose "Percent (%)" for the back office field "Apply a discount"` | Choose an option of a back-office field made of radio buttons or of a select, found by the label of the field and the label of the option. |
| `When I open the back office form tab "Actions"` | Open a tab of a back-office form by its title (the tabs of the product page, or "Information", "Conditions", "Actions" of a cart rule). |
| `When I save the back office form` | Save the back-office form of the page with its "Save" button and wait for the answer of the back office. |

### The back office: products, orders, modules, clean-up — `prestashop-catalog.steps.js` (32 steps)

| Step (first example) | What it does |
|---|---|
| `When I create a "standard" product` | Create a product of a type from the products list. |
| `When I set the product name to "Webship test mug"` | Set the name of the product on the product page. |
| `Then the product name should be "Webship test mug"` | Assert the name the product page shows. |
| `When I set the product price to "21.50"` | Set the retail price of the product, tax excluded (Pricing tab). |
| `Then the product price should be "21.50"` | Assert the retail price of the product, tax excluded, as a number. |
| `When I add 5 items to the product stock` | Add items to, or remove items from, the stock of the product (Stocks tab). |
| `Then the product stock should be 305` | Assert the quantity in stock the product page shows (Stocks tab, "Edit quantity"), as saved. |
| `When I set the product reference to "webship_1"` | Set the reference of the product (Details tab). |
| `When I add the product to the category "Men"` | Add the product to a category. |
| `Then the product should be in the category "Men"` | Assert that the product page lists, or does not list, a category among the categories of the product (Description tab). |
| `When I upload the product image "product.png"` | Upload an image of the product from the fixtures folder of the suite (`tests/fixtures`), on the Description tab. |
| `Then the product should have 1 image` | Assert how many images the product has (Description tab). |
| `When I put the product online` | Put the product online (visible in the shop) or offline, with the switch at the top of the product page. |
| `Then the product should be online` | Assert whether the product page shows the product as online or offline. |
| `When I save the product` | Save the product ("Save") and wait for the product page to load again with the answer of the back office. |
| `When I delete the product from its page` | Start deleting the product from its page (the menu next to "Go to catalog", "Delete"). |
| `When I go back to the catalog` | Leave the product page for the products list ("Go to catalog"). |
| `Given no "Webship test mug" is left in "Catalog > Products"` | Delete every record of a list of the back office whose row shows the given text, and confirm each dialog. |
| `When I open the placed order in the back office` | Open the page of the order that was placed in the shop earlier in the scenario (the step "I place the order" remembers its reference), from the orders list of the back office. |
| `Then I should see the placed order in the list` | Assert that the list of the page (the orders list) shows the order that was placed in the shop earlier in the scenario, by its reference. |
| `Then the order page should be titled "KHWLILZLL from John DOE"` | Assert the title of the order page. |
| `When I change the order status to "Payment accepted"` | Change the status of the order on its page. |
| `Then the order status should be "Payment accepted"` | Assert the current status of the order, as its page shows it. |
| `Then the latest order history entry should be "Payment accepted"` | Assert the newest line of the status history of the order. |
| `Then the order history should have 2 entries` | Assert how many lines the status history of the order has. |
| `When I set the order note to "Call the customer before shipping"` | Write the private note of the order ("Order private note") and save it. |
| `Then the order note should be "Call the customer before shipping"` | Assert the private note of the order. |
| `Then the order should contain the product "Mug The best is yet to come"` | Assert that the order page lists a product among the products of the order. |
| `When I search the modules for "Banner"` | Search the Module manager for a word. |
| `Then I should see the module "Banner"` | Assert that the Module manager shows, or does not show, the card of a module (after a search, only the matching cards are shown). |
| `When I disable the module "Banner"` | Enable or disable an installed module in the Module manager, confirm the dialog a disable asks for, and wait until the card shows the new state. |
| `Then the module "Banner" should be enabled` | Assert whether an installed module is enabled or disabled, as its card in the Module manager says. |

### The shop — `prestashop.steps.js` (64 steps)

| Step (first example) | What it does |
|---|---|
| `Given I am signed in to the shop as "customer"` | Sign in to the shop as a customer of the registry (`worldParameters.customers` in cucumber.js), by its handle. |
| `When I sign in to the shop with "customer@example.com" and "wrong-password"` | Send the sign-in form of the shop with an e-mail address and a password, without expecting it to succeed. |
| `When I sign out of the shop` | Sign out of the shop through the customer menu of the header ("Sign out"). |
| `Then I should be signed in to the shop` | Assert that a customer is signed in to the shop, optionally by the name the header shows, or that nobody is. |
| `Given I am on the shop "cart" page` | Open a page of the shop by its kind. |
| `Then I should be on a "category" shop page` | Assert the kind of shop page that is shown, as the shop names it (the id of the body). |
| `When I open "Clothes" in the shop menu` | Open a category from the main menu of the shop. |
| `Then the shop breadcrumb should be "Home > Accessories"` | Assert the breadcrumb of the shop page, written with " > " between its parts. |
| `Then the product list should show 11 products` | Assert how many products the product list shows on this page. |
| `Then the product list should announce "There are 11 products."` | Assert the sentence above the product list that counts the products found, for example "There are 11 products." The text may be a part of it. |
| `Then I should see the product "Customizable mug" in the product list` | Assert that the product list shows, or does not show, a product by its name. |
| `Then the first product of the product list should be "Brown bear cushion"` | Assert the product at a position of the product list (first, second, third… or last), to check a sort order. |
| `When I sort the product list by "Name, A to Z"` | Sort the product list by one of the orders of its "Sort by" menu. |
| `Then the product list should be sorted by "Name, A to Z"` | Assert the sort order the product list says it uses. |
| `When I filter the product list by "Categories" with "Stationery"` | Filter the product list with one option of a filter of the "Filter By" block (the filter is opened first, when it is folded). |
| `Then the active filters should include "Categories: Stationery"` | Assert that the product list shows, or does not show, an active filter ("Categories. |
| `When I remove the active filter "Categories: Stationery"` | Remove an active filter of the product list by pressing its chip. |
| `When I go to the next page of the product list` | Go to the next page, the previous page or a numbered page of the product list. |
| `Then the product list should be on page 2` | Assert the page of the product list that is shown, by its number. |
| `When I search the shop for "mug"` | Search the shop. |
| `When I type "mug" in the shop search` | Type words in the search box of the header without sending them, to see the suggestions the shop offers while typing. |
| `Then the search suggestions should include "Customizable mug"` | Assert that the suggestions under the search box include, or do not include, a product. |
| `When I open the product "Hummingbird printed t-shirt"` | Open the page of a product by pressing its name on a product card of the current page (the home page, a category, the search results). |
| `When I choose "M" for the product option "Size"` | Choose a value for an option of the product (a combination). |
| `Then the product option "Size" should be "M"` | Assert the value the product page shows as chosen for an option. |
| `When I set the quantity to buy to 2` | Set the quantity to buy on the product page. |
| `Then the price of the product should be "$19.12"` | Assert the price the product page shows for the product (the current price, after a discount), as the page writes it. |
| `When I add the product to the cart` | Add the product of the product page to the cart ("Add to cart") and wait for the dialog that confirms it. |
| `Then the cart dialog should show "Hummingbird printed t-shirt"` | Assert that the dialog shown after "Add to cart" contains a text. |
| `When I continue shopping from the cart dialog` | Leave the cart dialog. |
| `Given my cart is empty` | Empty the cart of the visitor. |
| `Then the cart should contain "Hummingbird printed t-shirt"` | Assert that the cart page lists, or does not list, a product. |
| `Then the cart should hold 2 items` | Assert how many items the cart holds (the sum of the quantities), as the shop itself counts them. |
| `When I change the cart quantity of "Hummingbird printed t-shirt" to 3` | Change the quantity of a line of the cart page. |
| `Then the cart quantity of "Hummingbird printed t-shirt" should be 3` | Assert the quantity of a line of the cart page. |
| `When I remove "Hummingbird printed t-shirt" from the cart` | Remove a product from the cart page with the "Remove" link of its line. |
| `Then the cart should be empty` | Assert that the cart page says the cart is empty. |
| `When I apply the voucher "WEBSHIP10"` | Apply a voucher (a cart rule code) on the cart page. |
| `Then the cart should have the voucher "Webship ten percent"` | Assert that the cart lists, or does not list, an applied voucher by the name of its cart rule. |
| `When I remove the voucher "Webship ten percent"` | Remove an applied voucher from the cart. |
| `Then the cart summary should show "Total (tax incl.)" as "$45.24"` | Assert a line of the cart summary. |
| `When I proceed to checkout` | Go on from the cart page to the checkout ("Proceed to checkout"). |
| `Then the checkout step should be "Personal Information"` | Assert which step of the checkout is open. |
| `When I fill in the checkout field "First name" with "Greta"` | Fill in a text field of the open checkout step, by its label ("First name", "Email", "Address", "City", "Zip/Postal Code"…). |
| `When I select "Florida" for the checkout field "State"` | Choose an option of a list field of the open checkout step, by its label ("State", "Country"). |
| `When I tick the checkout box "Customer data privacy"` | Tick a consent or an option of the open checkout step, by the start of its label ("Customer data privacy", "I agree to the terms and conditions and the privacy policy", "Sign up for our newsletter"). |
| `When I choose the delivery address "Home"` | Choose one of the saved addresses of the customer as the delivery address, by its alias, on the Addresses step. |
| `When I choose the delivery option "My carrier"` | Choose a delivery option (a carrier) by its name on the Shipping Method step. |
| `When I continue the checkout` | Confirm the open checkout step and go to the next one (its "Continue" button), then wait for the next step to open. |
| `When I choose the payment method "Pay by bank wire"` | Choose a payment method on the Payment step, by the label of its option ("Pay by bank wire", "Pay by Check", "Pay by Cash on Delivery"). |
| `When I accept the terms of service` | Accept the terms of service on the Payment step (the box "I agree to the terms of service…"). |
| `Then the place order button should be disabled` | Assert whether the "Place Order" button of the Payment step can be pressed. |
| `When I place the order` | Place the order ("Place Order") and wait for the order confirmation page. |
| `Then the order should be confirmed` | Assert that the order confirmation page is shown ("Your order is confirmed"). |
| `Then the order confirmation should show "Payment method: Bank transfer"` | Assert a detail of the order confirmation page, as it is written under "Order details" ("Payment method. |
| `Then my order history should list the placed order` | Assert that the order history of the customer lists the order placed earlier in the scenario, optionally with a status. |
| `When I open the placed order in my order history` | Open the details of the order placed earlier in the scenario from the order history of the customer. |
| `Then I should see the address "Home"` | Assert that the address book of the customer shows, or does not show, an address by its alias. |
| `Given I have no address "Office"` | Make sure the address book of the signed-in customer holds no address with the given alias. |
| `When I delete the address "Office"` | Edit or delete an address of the address book of the customer, by its alias. |
| `When I fill in the shop field "Alias" with "Office"` | Fill in a field of the form of the page in the shop, by its label, inside the main content. |
| `When I select "Florida" for the shop field "State"` | Choose an option of a list field of the form of the page in the shop, by its label ("State", "Country", "Subject"). |
| `When I tick the shop box "Customer data privacy"` | Tick a box of the form of the page in the shop, by the start of its label (the consents of the registration form). |
| `When I send the shop form` | Send the form of the page in the shop with its own button ("Save" of an address, "Create account" of the registration, "Send your message" of the contact page) and wait for the answer. |
<!-- steps:end -->

Each step has a JSDoc block with five example phrasings in its file under
[`tests/step-definitions`](tests/step-definitions).

## Clean-up

What a scenario creates, it removes. One step does it for the lists of the back office, at the start (an earlier run may
have stopped half-way) and at the end:

```gherkin
Given no "Webship test mug" is left in "Catalog > Products"
And no "newcomer@example.com" is left in "Customers > Customers"
```

Orders are the exception of the platform: an order cannot be deleted. The scenarios that place one cancel it (the stock
comes back) and remove the guest customer. `Given my cart is empty` and `Given I have no address "Office"` do the same
for the cart and the address book of a customer.

## Run the suite of this repository

```bash
npm ci
npx playwright install chromium
# Builds a shop with the demo catalog and the accounts in a DDEV project (project "prestashop-ci").
.github/scripts/build-ddev-prestashop.sh
npm run test:examples      # every example and feature step against the step patterns
npx cucumber-js --dry-run  # no undefined, no ambiguous step
npx cucumber-js            # the suite
```

The build script installs the release from the command line, only with the modules of the open source release: no
marketplace, account, hosted checkout, marketing or AI module is installed, and the shop sends no e-mail.
`SHOP_VERSION`, `PHP_VERSION`, `PROJECT_NAME`, `SITE_DIR` and `ADMIN_FOLDER` change the build; `LAUNCH_URL` and
`ADMIN_FOLDER` point the suite at another shop.

## Tested on

- PrestaShop 9.2.1 (PHP 8.3, MariaDB 10.11), the default theme (Hummingbird 2.1), English, one shop, default currency and
  country of the installer (United States).

Not covered: the Classic theme and themes built on it (the back-office steps do not depend on the theme, the shop steps
were only run on Hummingbird), other languages of the back office (the menu, the buttons and the messages are matched by their English
text), multistore, the one-page checkout, online payment modules, returns and credit slips, the import, the web service.

## License

MIT

## Logo

The PrestaShop logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The PrestaShop name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
