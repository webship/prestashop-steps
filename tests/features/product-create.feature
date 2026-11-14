@back-office @products
Feature: Create, edit, duplicate and delete a product
  As an employee of the shop
  I want to add a product with its price, stock, category and image
  So that customers can buy it

  Background:
    Given I am logged in to the back office as "admin"
    And no "Webship test mug" is left in "Catalog > Products"
    And no "copy of Customizable mug" is left in "Catalog > Products"
    # A product that was created but never saved with a name.
    And no "N/A" is left in "Catalog > Products"

  @critical
  Scenario: A product from creation to the shop and back
    When I create a "standard" product
    Then the product should be offline
    When I set the product name to "Webship test mug"
    And I set the product price to "21.50"
    And I set the product reference to "webship_1"
    And I add 5 items to the product stock
    And I add the product to the category "Art"
    And I upload the product image "product.png"
    And I put the product online
    And I save the product
    Then I should see the success message "Successful update"
    And I should not see any error message
    And the product name should be "Webship test mug"
    And the product price should be "21.5"
    And the product stock should be 5
    And the product should be in the category "Art"
    And the product should have 1 image
    And the product should be online
    When I go back to the catalog
    Then I should see "Webship test mug" in the list
    And the "Reference" of the list row "Webship test mug" should be "webship_1"
    And the "Quantity" of the list row "Webship test mug" should be "5"
    And the "Status" switch of the list row "Webship test mug" should be on
    # The shop shows it at once.
    When I go to the homepage
    And I search the shop for "Webship test mug"
    Then I should see the product "Webship test mug" in the product list
    # Remove it from its own page.
    When I open "Catalog > Products" in the back office menu
    And I open the list row "Webship test mug"
    And I delete the product from its page
    Then I should see the confirmation dialog "Permanently delete this product?"
    When I confirm the dialog
    Then I should see the success message "Successful deletion"
    And I should not see "Webship test mug" in the list

  Scenario: Stock is changed by a difference
    When I create a "standard" product
    And I set the product name to "Webship test mug"
    And I add 12 items to the product stock
    And I save the product
    Then the product stock should be 12
    When I remove 2 items from the product stock
    And I save the product
    Then I should see the success message "Successful update"
    And the product stock should be 10
    And no "Webship test mug" is left in "Catalog > Products"

  Scenario: A negative price is refused
    When I create a "standard" product
    And I set the product name to "Webship test mug"
    And I set the product price to "-5"
    And I save the product
    Then I should see the error message "This value should be either positive or zero."
    And I should not see the success message "Successful update"
    # The refused product keeps no name: the list shows it as "N/A".
    And no "N/A" is left in "Catalog > Products"

  Scenario: Duplicate a product from the list
    When I open "Catalog > Products" in the back office menu
    And I choose "Duplicate" for the list row "Customizable mug"
    Then I should see the confirmation dialog "Duplicate product"
    When I confirm the dialog
    Then I should see the success message "Successful duplication"
    And the product name should be "copy of Customizable mug"
    And the product should be offline
    When I delete the product from its page
    And I confirm the dialog
    Then I should see the success message "Successful deletion"
    And I should not see "copy of Customizable mug" in the list
    But I should see "Customizable mug" in the list

  Scenario: Cancelling the dialog deletes nothing
    When I open "Catalog > Products" in the back office menu
    And I choose "Delete" for the list row "Customizable mug"
    Then I should see the confirmation dialog "Delete selection"
    When I cancel the dialog
    Then I should not see a confirmation dialog
    And I should see "Customizable mug" in the list
    And the list should have 19 rows
