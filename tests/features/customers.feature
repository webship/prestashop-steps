@back-office @customers
Feature: Customers, addresses and shopping carts in the back office
  As an employee of the shop
  I want to find a customer and what belongs to them
  So that I can answer their questions

  Background:
    Given I am logged in to the back office as "admin"

  @critical
  Scenario: Find a customer and view the account
    When I open "Customers > Customers" in the back office menu
    And I reset the list filters
    And I filter the list by "Email address" with "customer@example.com"
    Then the list should have 1 row
    And the "First name" of the list row "customer@example.com" should be "Clara"
    And the "Group" of the list row "customer@example.com" should be "Customer"
    When I choose "View" for the list row "customer@example.com"
    Then the back office page title should be "Customer C. Customer"
    And I should see "customer@example.com"
    And I should see "16 Main Street"
    When I open "Customers > Customers" in the back office menu
    And I reset the list filters
    Then I should see "shopper@example.com" in the list

  Scenario: The addresses of the customers
    When I open "Customers > Addresses" in the back office menu
    And I reset the list filters
    And I filter the list by "Last name" with "Shopper"
    Then the list should have 1 row
    And the "City" of the list row "Shopper" should be "Miami"
    And the "Zip/Postal code" of the list row "Shopper" should be "33133"
    And I reset the list filters

  Scenario: The shopping carts
    When I open "Orders > Shopping Carts" in the back office menu
    And I reset the list filters
    Then I should see "J. DOE" in the list
    And I should see "Ordered" in the list
