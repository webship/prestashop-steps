@shop @contact @round-trip
Feature: The contact form
  As a customer of the shop
  I want to write to the shop
  So that I get an answer to my question

  @critical
  Scenario: A message from the contact form reaches the customer service
    Given I am logged in to the back office as "admin"
    And no "Webship test message" is left in "Customer Service > Customer Service"
    When I go to the shop "contact" page
    Then I should be on a "contact" shop page
    When I select "Customer service" for the shop field "Subject"
    And I fill in the shop field "Email address" with "customer@example.com"
    And I fill in the shop field "Message" with "Webship test message: where is my order?"
    And I send the shop form
    Then I should see the success message "Your message has been successfully sent to our team."
    When I open "Customer Service > Customer Service" in the back office menu
    Then the back office page title should be "Customer Service"
    And I should see "Webship test message: where is my order?" in the list
    And the "Email" of the list row "Webship test message" should be "customer@example.com"
    And no "Webship test message" is left in "Customer Service > Customer Service"
