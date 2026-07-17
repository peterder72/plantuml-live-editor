Feature: Use the standalone source editor
  CodeMirror-specific authoring behavior belongs to the standalone application.

  Scenario: Fold and unfold nested PlantUML source
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      !if %true()
      Alice -> Bob: Hidden while folded
      Bob --> Alice: Also hidden
      !endif
      @enduml
      """
    When I fold and unfold the nested source
