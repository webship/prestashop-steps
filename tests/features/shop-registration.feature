@shop @registration
Feature: Register as a customer
  As a visitor of the shop
  I want to create an account
  So that I can follow my orders

  @critical
  Scenario: A visitor registers and the back office lists the customer
    Given I am logged in to the back office as "admin"
    And no "newcomer@example.com" is left in "Customers > Customers"
    When I go to the shop "registration" page
    Then I should be on a "registration" shop page
    When I fill in the shop field "First name" with "Nora"
    And I fill in the shop field "Last name" with "Newcomer"
    And I fill in the shop field "Email" with "newcomer@example.com"
    And I fill in the shop field "Password" with "Newcomer123456789!"
    And I tick the shop box "Customer data privacy"
    And I tick the shop box "I agree to the terms and conditions and the privacy policy"
    And I send the shop form
    Then I should be signed in to the shop as "Nora Newcomer"
    And I should be on a "index" shop page
    When I sign out of the shop
    Then I should not be signed in to the shop
    # The back office lists the new customer; the suite removes it.
    When I open "Customers > Customers" in the back office menu
    And I reset the list filters
    Then I should see "newcomer@example.com" in the list
    And the "Last name" of the list row "newcomer@example.com" should be "Newcomer"
    When I choose "Delete" for the list row "newcomer@example.com"
    Then I should see the confirmation dialog "How do you want to delete the selected customers?"
    When I confirm the dialog
    Then I should see the success message "Successful deletion"
    And I should not see "newcomer@example.com" in the list

  Scenario: An e-mail address can only register once
    When I go to the shop "registration" page
    And I fill in the shop field "First name" with "Clara"
    And I fill in the shop field "Last name" with "Customer"
    And I fill in the shop field "Email" with "customer@example.com"
    And I fill in the shop field "Password" with "Customer123456789!"
    And I tick the shop box "Customer data privacy"
    And I tick the shop box "I agree to the terms and conditions and the privacy policy"
    And I send the shop form
    Then I should see the error message "The email is already used, please choose another one or sign in"
    And I should not be signed in to the shop
    And I should be on a "registration" shop page
