@back-office @permissions
Feature: What a limited employee can and cannot open
  As the owner of the shop
  I want an employee with the Salesman profile to see orders and the catalog only
  So that modules, the team and the dashboard stay with the administrator

  Background:
    Given I am logged in to the back office as "salesman"

  @critical
  Scenario: The menu only lists what the profile may open
    Then I should see "Orders > Orders" in the back office menu
    And I should see "Catalog > Products" in the back office menu
    But I should not see "Modules" in the back office menu
    And I should not see "Dashboard" in the back office menu
    And I should not see "Customers > Customers" in the back office menu
    And I should not see "Advanced Parameters > Team" in the back office menu

  Scenario Outline: A page of the administrator is refused
    When I open the back office path "<path>"
    Then I should see the access denied page
    And I should see "Back to previous page"

    Examples:
      | path                                |
      | improve/modules/manage              |
      | configure/advanced/employees/       |
      | index.php?controller=AdminDashboard |

  Scenario: A page of the profile opens
    When I open "Catalog > Products" in the back office menu
    Then I should not see the access denied page
    And the back office page title should be "Products"
    And I should see "Customizable mug" in the list

  Scenario: The orders are open to the profile
    When I open "Orders > Orders" in the back office menu
    Then I should not see the access denied page
    And I should see "XKBKNABJK" in the list
