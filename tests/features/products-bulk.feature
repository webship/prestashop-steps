@back-office @products @lists
Feature: Bulk actions and the status switch of the products list
  As an employee of the shop
  I want to act on several products at once
  So that I do not open each product

  Background:
    Given I am logged in to the back office as "admin"
    And no "Webship bulk mug" is left in "Catalog > Products"
    And no "N/A" is left in "Catalog > Products"

  Scenario: Activate, switch off and delete a product from the list
    When I create a "standard" product
    And I set the product name to "Webship bulk mug"
    And I save the product
    And I go back to the catalog
    Then the "Status" switch of the list row "Webship bulk mug" should be off
    # Bulk action: activate.
    When I select the list row "Webship bulk mug"
    And I choose the bulk action "Activate selection"
    Then I should see the confirmation dialog "Activating 1 products"
    When I confirm the dialog
    And I wait for the bulk action to finish
    Then the "Status" switch of the list row "Webship bulk mug" should be on
    # The switch of the row.
    When I flip the "Status" switch of the list row "Webship bulk mug"
    Then I should see the notification "The status has been successfully updated."
    And the "Status" switch of the list row "Webship bulk mug" should be off
    # Bulk action: delete.
    When I select the list row "Webship bulk mug"
    And I choose the bulk action "Delete selection"
    And I confirm the dialog
    And I wait for the bulk action to finish
    Then I should not see "Webship bulk mug" in the list
    And the list should have 19 rows
