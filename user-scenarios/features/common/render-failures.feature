Feature: Preserve a useful diagram when rendering fails
  A failed edit must not replace the last valid SVG.

  Scenario: Preserve the last valid diagram and recover after correction
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Valid request
      @enduml
      """
    And I remember the current diagram
    When I replace the PlantUML source with:
      """
      @startuml
      !includeurl https://example.invalid/invalid-edit.puml
      Alice -> Bob
      @enduml
      """
    Then a diagram error containing "disabled for privacy" is shown
    And the previous diagram is preserved
    When I replace the PlantUML source with:
      """
      @startuml
      Alice -> Bob: Corrected request
      Bob --> Alice: Corrected response
      @enduml
      """
    Then the diagram is rerendered

  Scenario: Preserve a large valid diagram when the rendering limit is exceeded
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      left to right direction
      skinparam ranksep 5000
      class A
      class B
      A -- B
      @enduml
      """
    Then the diagram is wider than 4096 pixels
    When I replace the PlantUML source with:
      """
      @startuml
      left to right direction
      skinparam ranksep 8200
      class A
      class B
      A -- B
      @enduml
      """
    Then a diagram error containing "max 8192" is shown
    And the previous diagram width is preserved
