@back-office @session
Feature: The employee session of the back office
  As an employee of the shop
  I want to log in to and out of the back office
  So that only employees manage the shop

  @critical
  Scenario: The administrator logs in and lands on the dashboard
    Given I am logged in to the back office as "admin"
    Then I should be logged in to the back office
    And the back office should greet "Shop"
    And the back office page title should be "Dashboard"
    And the current back office menu item should be "Dashboard"

  Scenario: A wrong password is refused with a message
    When I log in to the back office with "admin@example.com" and "wrong-password"
    Then I should not be logged in to the back office
    And I should see the error message "The employee does not exist, or the password provided is incorrect."

  Scenario: An unknown employee is refused with the same message
    When I log in to the back office with "nobody@example.com" and "Whatever123456789!"
    Then I should not be logged in to the back office
    And I should see the error message "The employee does not exist, or the password provided is incorrect."

  Scenario: The employee logs out from a legacy page
    Given I am logged in to the back office as "admin"
    When I log out of the back office
    Then I should not be logged in to the back office

  Scenario: The employee logs out from a new page
    Given I am logged in to the back office as "admin"
    And I open "Catalog > Products" in the back office menu
    When I log out of the back office
    Then I should not be logged in to the back office

  Scenario: A limited employee lands on its own start page
    Given I am logged in to the back office as "salesman"
    Then the back office should greet "Sam"
    And the back office page title should be "Orders"

  Scenario: An address without the security token is not opened
    Given I am logged in to the back office as "admin"
    When I open the back office path "sell/catalog/products/" without the security token
    Then I should see the invalid security token page
    And I should see "I understand the risk"

  Scenario: The same address with the security token opens
    Given I am logged in to the back office as "admin"
    When I open the back office path "sell/catalog/products/"
    Then I should not see the invalid security token page
    And the back office page title should be "Products"
