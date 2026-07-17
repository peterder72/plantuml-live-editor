Feature: Live diagram editing
  Users should see their diagram update when they change valid PlantUML source.

  Scenario: Edit and rerender a sequence diagram
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Initial request
      @enduml
      """
    And I remember the current diagram
    When I replace the PlantUML source with:
      """
      @startuml
      Alice -> Bob: Authenticate
      Bob --> Alice: Token
      @enduml
      """
    Then the editor contains that PlantUML source
    And the diagram is rerendered
