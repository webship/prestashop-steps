@back-office @navigation
Feature: The main menu, the title and the breadcrumb of the back office
  As an employee of the shop
  I want to reach every screen from the main menu
  So that I always know where I am

  Background:
    Given I am logged in to the back office as "admin"

  @critical
  Scenario: A new page opened from the menu
    When I open "Catalog > Products" in the back office menu
    Then the back office page title should be "Products"
    And the back office breadcrumb should be "Catalog > Products"
    And the current back office menu item should be "Products"

  Scenario: A legacy page opened from the menu
    When I open "Catalog > Discounts" in the back office menu
    Then the back office page title should be "Cart Rules"
    And the back office breadcrumb should be "Discounts > Cart Rules"

  Scenario Outline: The lists of the Sell section
    When I open "<menu>" in the back office menu
    Then the back office page title should be "<title>"
    And the back office breadcrumb should be "<breadcrumb>"

    Examples:
      | menu                     | title          | breadcrumb               |
      | Orders > Orders          | Orders         | Orders                   |
      | Orders > Shopping Carts  | Shopping Carts | Orders > Shopping Carts  |
      | Customers > Customers    | Customers      | Customers                |
      | Customers > Addresses    | Addresses      | Customers > Addresses    |
      | Modules > Module Manager | Module manager | Module Manager > Modules |

  Scenario: The menu shows the three sections to the administrator
    Then I should see "Orders > Orders" in the back office menu
    And I should see "Catalog > Discounts" in the back office menu
    And I should see "Modules > Module Manager" in the back office menu
    And I should see "Advanced Parameters > Team" in the back office menu
    But I should not see "Catalog > Vouchers" in the back office menu
