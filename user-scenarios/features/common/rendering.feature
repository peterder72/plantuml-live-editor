Feature: Render PlantUML while editing
  Users can render supported diagrams and always see the newest valid source.

  Scenario: Render representative sequence, class, and component diagrams
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Sequence request
      @enduml
      """
    And I remember the current diagram
    When I replace the PlantUML source with:
      """
      @startuml
      class Customer
      class Order
      Customer --> Order
      @enduml
      """
    Then the editor contains that PlantUML source
    And the diagram is rerendered
    Given I remember the current diagram
    When I replace the PlantUML source with:
      """
      @startuml
      component Browser
      component Renderer
      Browser --> Renderer
      @enduml
      """
    Then the editor contains that PlantUML source
    And the diagram is rerendered

  Scenario: Render only the final source from a rapid edit burst
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Initial request
      @enduml
      """
    And I remember the current diagram
    When I rapidly replace the PlantUML source with these versions:
      | @startuml\nAlice -> Bob: Superseded request\n@enduml |
      | @startuml\nAlice -> Bob: Final request\nBob --> Alice: Final response\n@enduml |
    Then the editor contains that PlantUML source
    And the diagram is rerendered
