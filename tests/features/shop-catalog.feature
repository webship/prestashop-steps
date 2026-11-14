@shop @catalog
Feature: Browse the catalog of the shop
  As a visitor of the shop
  I want to browse categories, sort and filter products
  So that I find what I want to buy

  @critical
  Scenario: The home page and a category from the main menu
    Given I am on the homepage
    Then I should be on a "index" shop page
    And I should see "Featured products"
    When I open "Accessories" in the shop menu
    Then I should be on a "category" shop page
    And the shop breadcrumb should be "Home > Accessories"
    And the product list should announce "There are 11 products."
    And the product list should show 11 products
    And I should see the product "Customizable mug" in the product list
    But I should not see the product "Hummingbird printed t-shirt" in the product list

  Scenario: A category of the submenu
    Given I am on the homepage
    When I open "Clothes > Men" in the shop menu
    Then the shop breadcrumb should be "Home > Clothes > Men"
    And the product list should show 1 product
    And I should see the product "Hummingbird printed t-shirt" in the product list

  Scenario: Sort the product list
    Given I am on the homepage
    And I open "Accessories" in the shop menu
    Then the product list should be sorted by "Relevance"
    When I sort the product list by "Name, A to Z"
    Then the product list should be sorted by "Name, A to Z"
    And the first product of the product list should be "Brown bear cushion"
    And the second product of the product list should be "Brown bear notebook"
    When I sort the product list by "Price, high to low"
    Then the first product of the product list should be "Pack Mug + Framed poster"

  Scenario: Filter the product list and remove the filter
    Given I am on the homepage
    And I open "Accessories" in the shop menu
    When I filter the product list by "Categories" with "Stationery"
    Then the active filters should include "Categories: Stationery"
    And the product list should announce "There are 3 products."
    And the product list should show 3 products
    And I should see the product "Brown bear notebook" in the product list
    But I should not see the product "Customizable mug" in the product list
    When I remove the active filter "Categories: Stationery"
    Then the active filters should not include "Categories: Stationery"
    And the product list should show 11 products

  Scenario: Page through a product list
    Given I am on "/index.php?id_category=2&controller=category"
    Then the product list should announce "There are 19 products."
    And the product list should show 12 products
    And the product list should be on page 1
    When I go to the next page of the product list
    Then the product list should be on page 2
    And the product list should show 7 products
    And I should see "Showing 13-19 of 19 item(s)"
    When I go to page 1 of the product list
    Then the product list should be on page 1
    And the product list should show 12 products

  Scenario: A page that does not exist
    Given I am on "/no-such-page-of-the-shop"
    Then I should be on a "pagenotfound" shop page
    And I should see "The page you are looking for was not found."
