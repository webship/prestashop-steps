@back-office @modules
Feature: Modules of the shop
  As the administrator of the shop
  I want to turn a module off and on again
  So that the shop only runs what it needs

  Background:
    Given I am logged in to the back office as "admin"
    And I open "Modules > Module Manager" in the back office menu

  Scenario: Search the installed modules
    When I search the modules for "Banner"
    Then I should see the module "Banner"
    But I should not see the module "Search bar"

  Scenario: Search the installed modules for two words
    When I search the modules for "Main menu"
    Then I should see the module "Main menu"
    But I should not see the module "Banner"

  @critical
  Scenario: Disable a module and enable it again
    Then the module "Banner" should be enabled
    When I disable the module "Banner"
    Then the module "Banner" should be disabled
    But I should not see the notification "Enable action on module ps_banner succeeded."
    When I enable the module "Banner"
    Then I should see the notification "Enable action on module ps_banner succeeded."
    And the module "Banner" should be enabled
