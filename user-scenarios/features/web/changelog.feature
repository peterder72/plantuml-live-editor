Feature: Read release history in the standalone application
  The web header exposes the changelog bundled into the offline artifact.

  Scenario: Open the JSON-backed changelog
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      component Changelog
      @enduml
      """
    When I open the changelog
    Then the changelog shows version "0.4.0"
    And the changelog contains "Centralized release history in CHANGELOG.json"
    When I close the changelog
    Then the changelog is closed
