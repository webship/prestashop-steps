@shop @checkout @round-trip
Feature: Check out as a customer and follow the order
  As a customer of the shop
  I want to order with my saved address and follow the order in my account
  So that I know what happens to it

  @critical
  Scenario: A customer pays by check, the employee accepts the payment, the customer sees it
    Given I am signed in to the shop as "customer"
    And my cart is empty
    And I am on "/index.php?id_product=7&controller=product"
    When I add the product to the cart
    And I proceed to checkout from the cart dialog
    And I proceed to checkout
    Then the checkout step should be "Addresses"
    When I choose the delivery address "Home"
    And I continue the checkout
    And I choose the delivery option "My carrier"
    And I continue the checkout
    And I choose the payment method "Pay by Check"
    And I accept the terms of service
    And I place the order
    Then the order should be confirmed
    And the order confirmation should show "Payment method: Payments by check"
    And my order history should list the placed order as "Awaiting check payment"
    When I open the placed order in my order history
    Then I should be on a "order-detail" shop page
    And I should see "Mug The adventure begins"
    # The employee.
    Given I am logged in to the back office as "admin"
    When I open "Orders > Orders" in the back office menu
    And I reset the list filters
    Then I should see the placed order in the list
    And the first row of the list should contain "C. Customer"
    When I open the placed order in the back office
    Then the order page should be titled "from Clara Customer"
    And the order status should be "Awaiting check payment"
    And the order history should have 1 entry
    When I change the order status to "Payment accepted"
    Then I should see the success message "Successful update"
    And the order status should be "Payment accepted"
    And the latest order history entry should be "Payment accepted" by "Shop Admin"
    And the order history should have 2 entries
    # The customer.
    Then my order history should list the placed order as "Payment accepted"
    # Clean up: an order cannot be deleted, so it is cancelled (the stock comes back).
    When I open the placed order in the back office
    And I change the order status to "Canceled"
    Then the latest order history entry should be "Canceled" by "Shop Admin"

  Scenario: A customer pays cash on delivery
    Given I am signed in to the shop as "shopper"
    And my cart is empty
    And I am on "/index.php?id_product=8&controller=product"
    When I add the product to the cart
    And I proceed to checkout from the cart dialog
    And I proceed to checkout
    And I continue the checkout
    And I continue the checkout
    And I choose the payment method "Pay by Cash on Delivery"
    And I accept the terms of service
    And I place the order
    Then the order should be confirmed
    And my order history should list the placed order as "Awaiting Cash On Delivery validation"
    Given I am logged in to the back office as "salesman"
    When I open the placed order in the back office
    Then the order page should be titled "from Simon Shopper"
    And the order status should be "Awaiting Cash On Delivery validation"
    When I change the order status to "Canceled"
    Then I should see the success message "Successful update"
    And my order history should list the placed order as "Canceled"
