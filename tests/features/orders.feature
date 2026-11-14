@back-office @orders
Feature: The orders of the back office
  As an employee of the shop
  I want to find an order and read what happened to it
  So that I can serve the customer

  Background:
    Given I am logged in to the back office as "admin"
    And I open "Orders > Orders" in the back office menu
    And I reset the list filters

  @critical
  Scenario: The demo orders are listed
    Then I should see "XKBKNABJK" in the list
    And the "Customer" of the list row "XKBKNABJK" should be "J. DOE"
    And the "Status" of the list row "XKBKNABJK" should be "Canceled"
    And the "Payment" of the list row "OHSATSERP" should be "Payment by check"
    And the "Delivery" of the list row "OHSATSERP" should be "United States"

  Scenario: Filter the orders by reference and by status
    When I filter the list by "Reference" with "OHSATSERP"
    Then the list should have 1 row
    And the first row of the list should contain "$169.90"
    When I reset the list filters
    And I filter the list by "Status" with "Payment error"
    Then the list should have 1 row
    And the first row of the list should contain "UOYEVOLI"
    And I reset the list filters

  Scenario: Open an order and read its status and history
    When I open the list row "OHSATSERP"
    Then the order page should be titled "OHSATSERP from John DOE"
    And the order status should be "Awaiting check payment"
    And the latest order history entry should be "Awaiting check payment"
    And the order history should have 1 entry

  Scenario: Add a private note to an order and remove it
    When I open the list row "OHSATSERP"
    And I set the order note to "Checked by the Webship suite"
    Then I should see the success message "Update successful"
    And the order note should be "Checked by the Webship suite"
    When I set the order note to ""
    Then I should see the success message "Update successful"
    And the order note should be ""
