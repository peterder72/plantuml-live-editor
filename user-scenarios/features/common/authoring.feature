Feature: Author diagrams with shared preview helpers
  Both applications support live flags, named views, and class interaction.

  Scenario: Toggle live content without moving the viewport
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      !$_live_SHOW_DETAILS = %false()
      class Always
      !if $_live_SHOW_DETAILS
      class Details
      !endif
      @enduml
      """
    And I pan and zoom the diagram
    Then the diagram does not contain "Details"
    When I enable the "SHOW_DETAILS" live flag
    Then the editor source contains "!$_live_SHOW_DETAILS = %true()"
    And the diagram contains "Details"
    And the viewport transform is preserved

  Scenario: Wrap selected source with a live flag
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      !$_live_DETAILS = %false()
      class Always
      class Details
      @enduml
      """
    When I select "class Details" in the source
    And I wrap the selection with the "DETAILS" live flag
    Then the editor source contains "!if $_live_DETAILS"
    And the editor source contains "!endif /' _live_DETAILS '/"
    And the diagram does not contain "Details"
    When I enable the "DETAILS" live flag
    Then the diagram contains "Details"

  Scenario: Persist independent live flag values in named views
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      !$_live_DETAILS = %false()
      class Always
      !if $_live_DETAILS
      class Details
      !endif
      @enduml
      """
    When I create the named view "Detailed"
    And I enable the "DETAILS" live flag
    And I switch to the named view "Default"
    Then the "DETAILS" live flag is disabled
    When I switch to the named view "Detailed"
    Then the "DETAILS" live flag is enabled
    And the editor source contains "\"activeView\": \"Detailed\""
    When I rename the active view to "Expanded"
    Then the editor source contains "\"activeView\": \"Expanded\""
    And the editor source does not contain "\"Detailed\":"

  Scenario: Hide and restore class members by clicking the class
    Given I have opened the application with this PlantUML source:
      """
      @startuml
      class User {
        +name: String
        +login(): void
      }
      @enduml
      """
    Then the diagram contains "login(): void"
    When I click the "User" class
    Then the editor source contains "hide User members"
    And the diagram does not contain "login"
    When I click the "User" class
    Then the editor source does not contain "hide User members"
    And the diagram contains "login"
