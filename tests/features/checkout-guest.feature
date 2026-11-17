@shop @checkout @round-trip
Feature: Check out as a guest and find the order in the back office
  As a visitor of the shop
  I want to order without an account and pay by bank wire
  So that I can buy at once

  @critical
  Scenario: A guest orders with a bank wire and the back office receives the order
    Given I am on the homepage
    And my cart is empty
    And I am on "/index.php?id_product=6&controller=product"
    When I add the product to the cart
    And I proceed to checkout from the cart dialog
    And I proceed to checkout
    Then I should be on a "checkout" shop page
    And the checkout step should be "Personal Information"
    When I fill in the checkout field "First name" with "Greta"
    And I fill in the checkout field "Last name" with "Guest"
    And I fill in the checkout field "Email" with "guest-buyer@example.com"
    And I tick the checkout box "Customer data privacy"
    And I tick the checkout box "I agree to the terms and conditions and the privacy policy"
    And I continue the checkout
    Then the checkout step should be "Addresses"
    When I fill in the checkout field "Address" with "1 Test Lane"
    And I fill in the checkout field "City" with "Miami"
    And I select "Florida" for the checkout field "State"
    And I fill in the checkout field "Zip/Postal Code" with "33133"
    And I continue the checkout
    Then the checkout step should be "Shipping Method"
    When I choose the delivery option "My carrier"
    And I continue the checkout
    Then the checkout step should be "Payment"
    And the place order button should be disabled
    When I choose the payment method "Pay by bank wire"
    Then the place order button should be disabled
    When I accept the terms of service
    Then the place order button should be enabled
    When I place the order
    Then the order should be confirmed
    And the order confirmation should show "An email has been sent to the guest-buyer@example.com address."
    And the order confirmation should show "Payment method: Bank transfer"
    And the order confirmation should show "Shipping method: My carrier"
    And the order confirmation should show "Mug The best is yet to come"
    And the cart should hold 0 items
    # The back office has the order.
    Given I am logged in to the back office as "admin"
    When I open "Orders > Orders" in the back office menu
    And I reset the list filters
    Then I should see the placed order in the list
    And the first row of the list should contain "G. Guest"
    And the first row of the list should contain "Bank transfer"
    And the first row of the list should contain "Awaiting bank wire payment"
    # The order is not among the cancelled ones.
    When I filter the list by "Status" with "Canceled"
    Then I should not see the placed order in the list
    When I reset the list filters
    And I open the placed order in the back office
    Then the order page should be titled "from Greta Guest"
    And the order status should be "Awaiting bank wire payment"
    And the order should contain the product "Mug The best is yet to come"
    But the order should not contain the product "Customizable mug"
    # Clean up: an order cannot be deleted, so it is cancelled (the stock comes back) and the guest is removed.
    When I change the order status to "Canceled"
    Then I should see the success message "Successful update"
    And no "guest-buyer@example.com" is left in "Customers > Customers"

  Scenario: A visitor starts the checkout on the first step
    Given I am on the homepage
    And my cart is empty
    And I am on "/index.php?id_product=6&controller=product"
    When I add the product to the cart
    And I proceed to checkout from the cart dialog
    And I proceed to checkout
    Then I should be on a "checkout" shop page
    And the checkout step should be "Personal Information"
    And I should see "Order as a guest"
    And I should not be signed in to the shop
    # Nothing is sent: a guest is only created when the first step is confirmed.
    And my cart is empty
