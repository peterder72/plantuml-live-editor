import { Given, Then, When } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../common/world";
import { WebScenarioDriver } from "./driver";

function driver(world: ScenarioWorld) {
  if (!(world.driver instanceof WebScenarioDriver)) {
    throw new Error("This step requires the web scenario driver.");
  }
  return world.driver;
}

Given("I am monitoring network egress", function (this: ScenarioWorld) {
  driver(this).enableEgressMonitoring();
});

Then("the application is running from its offline artifact", async function (this: ScenarioWorld) {
  await driver(this).expectOfflineArtifact();
});

Then("no network egress was attempted", async function (this: ScenarioWorld) {
  await driver(this).expectNoEgress();
});

When("I fold and unfold the nested source", async function (this: ScenarioWorld) {
  await driver(this).foldAndUnfoldSource();
});

When("I reload the offline application", async function (this: ScenarioWorld) {
  await driver(this).reload();
});

When("I resize the editor and preview", async function (this: ScenarioWorld) {
  await driver(this).resizeEditorAndPreview();
});

Then(
  "the resized editor and preview split is restored",
  async function (this: ScenarioWorld) {
    await driver(this).expectEditorAndPreviewSplitRestored();
  },
);
