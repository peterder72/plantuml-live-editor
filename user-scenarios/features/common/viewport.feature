Feature: Control the diagram viewport
  Rendering changes must not override the user's chosen view.

  Background:
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      class Customer
      class Order
      Customer --> Order
      @enduml
      """

  Scenario: Preserve pan and zoom across a rerender
    When I pan and zoom the diagram
    And I replace the PlantUML source with:
      """
      @startuml
      class Customer
      class Order
      class Invoice
      Customer --> Order
      Order --> Invoice
      @enduml
      """
    Then the diagram contains "Invoice"
    And the viewport transform is preserved

  Scenario: Fit and reset only when explicitly requested
    When I pan and zoom the diagram
    And I explicitly fit and reset the diagram
