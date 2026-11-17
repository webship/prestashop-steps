@back-office @shop @discounts
Feature: A discount code from the back office to the cart
  As the administrator of the shop
  I want to create a cart rule with a code
  So that customers get a discount in their cart

  Background:
    Given I am logged in to the back office as "admin"
    And no "Webship ten percent" is left in "Catalog > Discounts"

  @critical
  Scenario: Create a cart rule, use its code in the cart, delete it
    When I open "Catalog > Discounts" in the back office menu
    And I press the back office toolbar button "Add new cart rule"
    And I fill in the back office field "Name" with "Webship ten percent"
    And I fill in the back office field "Code" with "WEBSHIP10"
    And I open the back office form tab "Actions"
    And I choose "Percent (%)" for the back office field "Apply a discount"
    And I fill in the back office field "Value" with "10"
    And I save the back office form
    Then I should see the success message "Successful creation"
    And I should see "Webship ten percent" in the list
    And the "Code" of the list row "Webship ten percent" should be "WEBSHIP10"
    # In the shop.
    Given my cart is empty
    And I am on "/index.php?id_product=6&controller=product"
    When I set the quantity to buy to 2
    And I add the product to the cart
    And I proceed to checkout from the cart dialog
    And I apply the voucher "NOPE"
    Then I should see the field error "This voucher does not exist."
    When I apply the voucher "WEBSHIP10"
    Then the cart should have the voucher "Webship ten percent"
    But I should not see the field error "This voucher does not exist."
    And the cart summary should show "Discount(s)" as "-$2.38"
    When I remove the voucher "Webship ten percent"
    Then the cart should not have the voucher "Webship ten percent"
    And my cart is empty
    # Delete the rule.
    When I open "Catalog > Discounts" in the back office menu
    And I choose "Delete" for the list row "Webship ten percent"
    Then I should see the confirmation dialog "Delete selected item?"
    When I confirm the dialog
    Then I should see the success message "Successful deletion"
    And I should not see "Webship ten percent" in the list
