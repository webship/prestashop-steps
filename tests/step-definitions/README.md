# Step definitions

| File | What it holds |
|---|---|
| `prestashop-helpers.js` | Not a step file. The wait budget, friendly errors, the accounts registries, the back-office session and its security token, messages, the three kinds of dialogs, the lists, the form fields by label, the `prestashop` object of the shop. Require it from your own steps. |
| `prestashop-back-office.steps.js` | The employee session, the main menu, title and breadcrumb, addresses with the security token, access denied, messages and notifications, confirmation dialogs, lists (filters, rows, row actions, bulk actions, switches, sorting, pagination), form fields by their visible label. |
| `prestashop-catalog.steps.js` | The product page (create, name, price, stock, reference, category, image, online/offline, save, delete), clean-up of what a scenario created, orders (status, history, note, products), modules (search, enable, disable). |
| `prestashop.steps.js` | The shop: customer session, page kind, menu and breadcrumb, product list (count, sort, filters, pagination), search, product page and cart dialog, cart and vouchers, checkout, order confirmation, order history, addresses, forms of the shop. |

## Rules for a new step

1. Open the screen in a real browser on a real install first and write the step from what is there: the roles and labels a
   person reads, then the hooks the platform gives every theme (`js-…` classes, `data-link-action`, core ids). Note which
   page generation the screen belongs to: new pages and legacy pages of the back office render lists, dialogs and messages
   differently.
2. Do not duplicate a webship-js step. `I should see "…"`, `I am on "…"`, `I press "…"` already exist.
3. No platform name in a step phrase. Say "the back office" and "the shop".
4. No fixed sleeps: wait on what the page does (a reload, a message, an attribute, the address).
5. Every failure says what was expected, what was found and where to look (`friendly`, `waitUntil`, `assertPresence`).
6. A JSDoc block with at least five `Example #n:` lines; `npm run test:examples` checks each one against the pattern
   and against every other step that is loaded with it.
7. A step never creates or deletes an employee. What a scenario creates, it removes (`no "…" is left in "…"`).
