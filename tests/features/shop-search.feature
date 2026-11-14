@shop @search
Feature: Search the shop
  As a visitor of the shop
  I want to search for a product by a word
  So that I do not browse every category

  @critical
  Scenario: A search with results
    Given I am on the homepage
    When I search the shop for "mug"
    Then I should be on a "search" shop page
    And I should see "Search results for"
    And the product list should announce "There are 5 products."
    And I should see the product "Customizable mug" in the product list
    And I should see the product "Mug The adventure begins" in the product list
    But I should not see the product "Brown bear notebook" in the product list

  Scenario: A search without results
    Given I am on the homepage
    When I search the shop for "zzzznothing"
    Then I should be on a "search" shop page
    And I should see "We couldn't find any matching products."

  Scenario: Suggestions while typing
    Given I am on the homepage
    When I type "mug" in the shop search
    Then the search suggestions should include "Customizable mug"
    And the search suggestions should include "Mug The adventure begins"
    But the search suggestions should not include "Brown bear notebook"

  Scenario: Open a product from the search results
    Given I am on the homepage
    When I search the shop for "cushion"
    And I open the product "Mountain fox cushion"
    Then I should be on a "product" shop page
    And I should see "Mountain fox cushion"
