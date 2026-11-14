@shop @account
Feature: The customer account
  As a customer of the shop
  I want to sign in and manage my addresses
  So that ordering is quick

  @critical
  Scenario: Sign in and out
    Given I am signed in to the shop as "customer"
    Then I should be signed in to the shop as "Clara Customer"
    When I am on the shop "my account" page
    Then I should be on a "my-account" shop page
    And the shop breadcrumb should be "Home > Your account"
    And I should see "Order history and details"
    When I sign out of the shop
    Then I should not be signed in to the shop

  Scenario: A wrong password is refused
    When I sign in to the shop with "customer@example.com" and "wrong-password"
    Then I should see the error message "Authentication failed."
    And I should not be signed in to the shop
    And I should be on a "authentication" shop page

  Scenario: The account pages need a customer
    Given I am on the homepage
    When I go to the shop "order history" page
    Then I should be on a "authentication" shop page
    And I should not be signed in to the shop

  Scenario: Add and delete an address
    Given I am signed in to the shop as "shopper"
    And I have no address "Office"
    When I am on the shop "addresses" page
    Then the shop breadcrumb should be "Home > Your account > Addresses"
    And I should see the address "Home"
    But I should not see the address "Office"
    When I go to the shop "new address" page
    And I fill in the shop field "Alias" with "Office"
    And I fill in the shop field "Address" with "2 Work Road"
    And I fill in the shop field "City" with "Tampa"
    And I select "Florida" for the shop field "State"
    And I fill in the shop field "Zip/Postal Code" with "33601"
    And I send the shop form
    Then I should see the success message "Address successfully added."
    And I should see the address "Office"
    And I should see "2 Work Road"
    When I edit the address "Office"
    And I fill in the shop field "City" with "Orlando"
    And I send the shop form
    Then I should see the success message "Address successfully updated."
    And I should see "Orlando"
    When I delete the address "Office"
    Then I should see the success message "Address successfully deleted."
    And I should not see the address "Office"
    And I should see the address "Home"

  Scenario: A customer without orders
    Given I am signed in to the shop as "shopper"
    When I am on the shop "my account" page
    Then I should see "Welcome Simon Shopper"
