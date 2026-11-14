@back-office @categories
Feature: Categories of the catalog
  As an employee of the shop
  I want to create, hide and delete categories
  So that the catalog is organised

  Background:
    Given I am logged in to the back office as "admin"
    And no "Webship test category" is left in "Catalog > Categories"

  @critical
  Scenario: Create, hide and delete a category
    When I open "Catalog > Categories" in the back office menu
    Then the back office page title should be "Categories"
    And I should see "Clothes" in the list
    When I press the back office toolbar button "Add new category"
    Then the back office page title should be "New category"
    When I fill in the back office field "Name" with "Webship test category"
    Then the back office field "Friendly URL" should contain "webship-test-category"
    When I save the back office form
    Then I should see the success message "Successful creation"
    And I should see "Webship test category" in the list
    And the "Displayed" switch of the list row "Webship test category" should be on
    When I flip the "Displayed" switch of the list row "Webship test category"
    Then the "Displayed" switch of the list row "Webship test category" should be off
    When I choose "Delete" for the list row "Webship test category"
    Then I should see the confirmation dialog "What do you want to do with the products associated with this category?"
    When I confirm the dialog
    Then I should see the success message "Successful deletion"
    And I should not see "Webship test category" in the list

  Scenario: A category needs a name
    When I open "Catalog > Categories" in the back office menu
    And I press the back office toolbar button "Add new category"
    And I save the back office form
    Then I should see the field error "The field name is required at least in your default language."
    And I should not see the success message "Successful creation"
    And the back office page title should be "New category"

  Scenario: Rename a category
    When I open "Catalog > Categories" in the back office menu
    And I press the back office toolbar button "Add new category"
    And I fill in the back office field "Name" with "Webship test category"
    And I save the back office form
    And I choose "Edit" for the list row "Webship test category"
    Then the back office field "Name" should contain "Webship test category"
    When I fill in the back office field "Name" with "Webship test category renamed"
    And I save the back office form
    Then I should see the success message "Successful update"
    And no "Webship test category" is left in "Catalog > Categories"
