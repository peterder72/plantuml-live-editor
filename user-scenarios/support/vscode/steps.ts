import { Then, When } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../common/world";
import { VsCodeScenarioDriver } from "./driver";

function driver(world: ScenarioWorld) {
  if (!(world.driver instanceof VsCodeScenarioDriver)) {
    throw new Error("This step requires the VS Code scenario driver.");
  }
  return world.driver;
}

When(
  "I open another PlantUML document with this source:",
  async function (this: ScenarioWorld, source: string) {
    this.latestSource = source;
    await driver(this).openAnotherDocument(source);
  },
);

Then("the preview follows that document", function (this: ScenarioWorld) {
  driver(this).expectSinglePreviewForCurrentDocument();
});
