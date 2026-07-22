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

When("I open the changelog", async function (this: ScenarioWorld) {
  await driver(this).openChangelog();
});

Then(
  "the changelog shows version {string}",
  async function (this: ScenarioWorld, version: string) {
    await driver(this).expectChangelogVersion(version);
  },
);

Then(
  "the changelog contains {string}",
  async function (this: ScenarioWorld, text: string) {
    await driver(this).expectChangelogContains(text);
  },
);

When("I close the changelog", async function (this: ScenarioWorld) {
  await driver(this).closeChangelog();
});

Then("the changelog is closed", async function (this: ScenarioWorld) {
  await driver(this).expectChangelogClosed();
});
