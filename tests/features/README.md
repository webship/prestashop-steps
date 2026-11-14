# Features

The suite of this pack. It runs against a shop built by `.github/scripts/build-ddev-prestashop.sh` (the demo catalog, the
accounts of `cucumber.js`) and leaves it as it found it: what a scenario creates, it removes. Orders are the exception the
platform imposes: an order cannot be deleted, so the scenarios that place one cancel it (the stock comes back) and remove
the guest customer.

| Feature | Area |
|---|---|
| `back-office-session` | employee sign in and out, the security token |
| `back-office-navigation` | main menu, title, breadcrumb on new and legacy pages |
| `back-office-permissions` | what the Salesman profile sees and what is refused |
| `products-list`, `products-bulk` | filters, sorting, pagination, row switch, bulk actions |
| `product-create` | create, edit, stock, category, image, duplicate, delete |
| `categories` | create, validation, rename, hide, delete |
| `orders` | list, filters, order page, history, private note |
| `customers` | customers, addresses, shopping carts |
| `modules` | search, disable, enable |
| `discounts` | a cart rule from the back office to the cart |
| `shop-catalog`, `shop-search` | categories, sort, filters, pagination, search, suggestions, 404 |
| `shop-product-cart` | combinations, quantity, the cart dialog, the cart |
| `checkout-guest`, `checkout-customer` | the checkout with bank wire, check and cash on delivery, and the order in the back office |
| `shop-account`, `shop-registration`, `shop-contact` | sign in, addresses, registration, contact form |

`@critical` marks the smoke lane: `CUCUMBER_TAGS=@critical npx cucumber-js`.
