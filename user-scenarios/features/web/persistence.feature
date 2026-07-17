Feature: Keep standalone work in browser storage
  The standalone application restores locally persisted source.

  Scenario: Persist source across reload
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      component PersistedSource
      @enduml
      """
    When I reload the offline application
    Then the editor contains that PlantUML source
    And the diagram contains "PersistedSource"
