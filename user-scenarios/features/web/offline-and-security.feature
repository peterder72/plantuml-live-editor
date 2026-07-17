Feature: Work privately from the offline artifact
  The standalone editor must render locally and reject every network path.

  Scenario: Render without network access
    Given I am monitoring network egress
    And I have opened the application with this PlantUML source:
      """
      @startuml
      component Browser
      component OfflineRenderer
      Browser --> OfflineRenderer
      @enduml
      """
    Then the application is running from its offline artifact
    And the diagram contains "OfflineRenderer"
    And no network egress was attempted

  Scenario: Reject a remote include before egress
    Given I am monitoring network egress
    And I have opened the application with this PlantUML source:
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
    And no network egress was attempted
