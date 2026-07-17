Feature: Export a rendered diagram
  Both applications let users select an SVG background and save the result.

  Scenario: Export an SVG with the chosen background
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      Alice -> Bob: Export me
      @enduml
      """
    When I export a white-background SVG
    Then the export choices remain selected
