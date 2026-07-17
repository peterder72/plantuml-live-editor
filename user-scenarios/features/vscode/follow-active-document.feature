Feature: Follow the active VS Code document
  The preview should remain a single panel and follow the PlantUML document being edited.

  Scenario: Reuse the preview for another PlantUML document
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: First document
      @enduml
      """
    And I remember the current diagram
    When I open another PlantUML document with this source:
      """
      @startuml
      component SecondDocument
      @enduml
      """
    Then the preview follows that document
    And the diagram is rerendered
