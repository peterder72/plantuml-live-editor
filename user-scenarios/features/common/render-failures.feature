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

  Scenario: Render labels that resemble diagnostics or SVG attributes
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Syntax Error?
      Bob --> Alice: Unsupported diagram type
      Alice -> Bob: onclick=handler href=destination
      Bob --> Alice: url(https://example.test)
      @enduml
      """
    And I remember the current diagram
    When I replace the PlantUML source with:
      """
      @startuml
      Alice -> Bob: Updated diagnostic examples
      Bob --> Alice: Syntax Error? onclick=handler
      @enduml
      """
    Then the diagram is rerendered

  Scenario: Preserve the last valid diagram after an actual syntax error
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Valid request
      @enduml
      """
    And I remember the current diagram
    When I pan and zoom the diagram
    When I replace the PlantUML source with:
      """
      @startuml
      Alice -> Bob: Valid request
      this is invalid ???
      @enduml
      """
    Then a diagram error containing "Syntax error near line" is shown
    And the previous diagram is preserved
    And source line 3 is highlighted as an error
    And the viewport transform is preserved
    When I replace the PlantUML source with:
      """
      @startuml
      Alice -> Bob: Corrected request
      @enduml
      """
    Then the diagram is rerendered
    And the source has no error highlights
    And the viewport transform is preserved
