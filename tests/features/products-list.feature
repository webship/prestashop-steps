@back-office @products @lists
Feature: The products list of the back office
  As an employee of the shop
  I want to search, sort and page through the products
  So that I find a product quickly

  Background:
    Given I am logged in to the back office as "admin"
    And I open "Catalog > Products" in the back office menu
    And I reset the list filters

  @critical
  Scenario: The demo catalog is listed
    Then the list should have 19 rows
    And I should see "Customizable mug" in the list
    And the "Reference" of the list row "Customizable mug" should be "demo_14"
    And the "Category" of the list row "Customizable mug" should be "Home Accessories"
    And the "Price (tax excl.)" of the list row "Customizable mug" should be "$13.90"
    And the "Quantity" of the list row "Customizable mug" should be "300"
    And the "Status" switch of the list row "Customizable mug" should be on

  Scenario: Filter by name, then reset
    When I filter the list by "Name" with "mug"
    Then the list should have 5 rows
    And I should see "Mug The adventure begins" in the list
    But I should not see "Hummingbird printed t-shirt" in the list
    When I reset the list filters
    Then the list should have 19 rows

  Scenario: Filter by reference and by category
    When I filter the list by "Reference" with "demo_14"
    Then the list should have 1 row
    And the first row of the list should contain "Customizable mug"
    When I reset the list filters
    And I filter the list by "Category" with "Stationery"
    Then the list should have 3 rows
    And I reset the list filters

  Scenario: A filter that finds nothing
    When I filter the list by "Name" with "zzzznothing"
    Then the list should have 0 rows
    And I should not see "Customizable mug" in the list
    And I reset the list filters

  Scenario: Sort by name and back
    When I sort the list by "Name" in ascending order
    Then the first row of the list should contain "Brown bear - Vector graphics"
    When I sort the list by "Name" in descending order
    Then the first row of the list should contain "Today is a good day Framed poster"
    # The list remembers the order for the employee: put the usual one back.
    When I sort the list by "ID" in ascending order
    Then the first row of the list should contain "Hummingbird printed t-shirt"
    When I sort the list by "ID" in descending order
    Then the first row of the list should contain "Customizable mug"

  Scenario: Page through the list
    Then the list pagination should read "Viewing 1-19 out of 19 (page 1 / 1)"
    When I show 10 rows per page in the list
    Then the list should have 10 rows
    And the list pagination should read "Viewing 1-10 out of 19 (page 1 / 2)"
    When I go to the next page of the list
    Then the list should have 9 rows
    And the list pagination should read "Viewing 11-19 out of 19 (page 2 / 2)"
    When I go to the previous page of the list
    Then the list pagination should read "page 1 / 2"
    When I show 20 rows per page in the list
    Then the list should have 19 rows

  Scenario: Open a product from its row
    When I open the list row "Customizable mug"
    Then the product name should be "Customizable mug"
    And the product should be online
    And the product price should be "13.9"
    And the product stock should be 300
    And the product should be in the category "Home Accessories"
    But the product should not be in the category "Art"
    And the product should have 1 image
