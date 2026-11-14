@shop @cart
Feature: The product page and the cart
  As a visitor of the shop
  I want to choose a product, its options and its quantity
  So that my cart holds what I want to buy

  @critical
  Scenario: Choose a combination and add it to the cart
    Given I am on the homepage
    And my cart is empty
    And I am on the homepage
    When I open the product "Hummingbird printed t-shirt"
    Then I should be on a "product" shop page
    And the shop breadcrumb should be "Home > Clothes > Men > Hummingbird printed t-shirt"
    And the price of the product should be "$19.12"
    And the product option "Size" should be "S"
    When I choose "M" for the product option "Size"
    And I choose "Black" for the product option "Color"
    Then the product option "Size" should be "M"
    And the product option "Color" should be "Black"
    When I set the quantity to buy to 2
    And I add the product to the cart
    Then the cart dialog should show "Added to your cart"
    And the cart dialog should show "Hummingbird printed t-shirt"
    And the cart dialog should show "Size: M"
    And the cart dialog should show "Color: Black"
    And the cart dialog should show "Quantity: 2"
    And the cart dialog should show "There are 2 items in your cart."
    When I continue shopping from the cart dialog
    Then I should be on a "product" shop page
    And the cart should hold 2 items
    And my cart is empty

  Scenario: Change the quantity in the cart and remove the product
    Given I am on the homepage
    And my cart is empty
    And I am on the homepage
    And I am on "/index.php?id_product=8&controller=product"
    When I add the product to the cart
    And I proceed to checkout from the cart dialog
    Then I should be on a "cart" shop page
    And the cart should contain "Mug Today is a good day"
    And the cart quantity of "Mug Today is a good day" should be 1
    When I change the cart quantity of "Mug Today is a good day" to 3
    Then the cart quantity of "Mug Today is a good day" should be 3
    And the cart should hold 3 items
    And the cart summary should show "3 items" as "$35.70"
    When I remove "Mug Today is a good day" from the cart
    Then I should see the success message "has been removed from the cart."
    And the cart should not contain "Mug Today is a good day"
    And the cart should be empty
    And I should see "There are no more items in your cart"

  Scenario: A cart is kept while browsing
    Given I am on the homepage
    And my cart is empty
    And I am on "/index.php?id_product=6&controller=product"
    When I add the product to the cart
    And I continue shopping from the cart dialog
    And I am on the homepage
    Then the cart should hold 1 item
    When I am on the shop "cart" page
    Then the cart should contain "Mug The best is yet to come"
    And the cart summary should show "1 item" as "$11.90"
    And my cart is empty
