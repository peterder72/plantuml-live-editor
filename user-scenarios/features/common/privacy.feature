Feature: Enforce offline privacy controls
  Both applications reject remote PlantUML and disable runtime network APIs.

  Scenario: Reject a remote include
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Valid diagram
      @enduml
      """
    When I replace the PlantUML source with:
      """
      @startuml
      !includeurl https://example.invalid/private-diagram.puml
      Alice -> Bob
      @enduml
      """
    Then a diagram error containing "disabled for privacy" is shown

  Scenario: Block runtime network APIs
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob
      @enduml
      """
    Then the runtime network APIs are blocked
