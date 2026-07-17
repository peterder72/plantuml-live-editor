import { Given, Then, When, type DataTable } from "@cucumber/cucumber";
import type { ScenarioWorld } from "./world";

Given(
  "I have opened the application with this PlantUML source:",
  async function (this: ScenarioWorld, source: string) {
    this.latestSource = source;
    await this.driver.openApplication(source);
  },
);

Given(
  "I remember the current diagram",
  async function (this: ScenarioWorld) {
    this.rememberedRender = await this.driver.captureRender();
  },
);

When(
  "I replace the PlantUML source with:",
  async function (this: ScenarioWorld, source: string) {
    this.latestSource = source;
    await this.driver.replaceSource(source);
  },
);

When(
  "I rapidly replace the PlantUML source with these versions:",
  async function (this: ScenarioWorld, table: DataTable) {
    const sources = table.raw().map((row) => row[0].replaceAll("\\n", "\n"));
    if (sources.length < 2) {
      throw new Error("A rapid edit scenario requires at least two source versions.");
    }
    this.latestSource = sources.at(-1);
    await this.driver.replaceSourceRapidly(sources);
  },
);

Then(
  "the editor contains that PlantUML source",
  async function (this: ScenarioWorld) {
    await this.driver.expectSource(this.requireLatestSource());
  },
);

Then("the diagram is rerendered", async function (this: ScenarioWorld) {
  await this.driver.expectRenderChanged(this.requireRememberedRender());
});

Then("the previous diagram is preserved", async function (this: ScenarioWorld) {
  await this.driver.expectRenderUnchanged(this.requireRememberedRender());
});

Then("the diagram contains {string}", async function (this: ScenarioWorld, text: string) {
  await this.driver.expectDiagramContains(text);
});

Then("the diagram does not contain {string}", async function (this: ScenarioWorld, text: string) {
  await this.driver.expectDiagramContains(text, false);
});

Then("the editor source contains {string}", async function (this: ScenarioWorld, text: string) {
  await this.driver.expectSourceContains(text);
});

Then("the editor source does not contain {string}", async function (this: ScenarioWorld, text: string) {
  await this.driver.expectSourceContains(text, false);
});

Then("a diagram error containing {string} is shown", async function (this: ScenarioWorld, text: string) {
  await this.driver.expectError(new RegExp(text));
});

When("I pan and zoom the diagram", async function (this: ScenarioWorld) {
  await this.driver.panAndZoom();
});

Then("the viewport transform is preserved", async function (this: ScenarioWorld) {
  await this.driver.expectTransformPreserved();
});

When("I explicitly fit and reset the diagram", async function (this: ScenarioWorld) {
  await this.driver.fitAndResetView();
});

When("I export a white-background SVG", async function (this: ScenarioWorld) {
  await this.driver.exportWhiteSvg();
});

Then("the export choices remain selected", async function (this: ScenarioWorld) {
  await this.driver.expectExportChoicesRemembered();
});

When("I enable the {string} live flag", async function (this: ScenarioWorld, name: string) {
  await this.driver.toggleLiveFlag(name, true);
});

When("I disable the {string} live flag", async function (this: ScenarioWorld, name: string) {
  await this.driver.toggleLiveFlag(name, false);
});

Then("the {string} live flag is enabled", async function (this: ScenarioWorld, name: string) {
  await this.driver.expectLiveFlag(name, true);
});

Then("the {string} live flag is disabled", async function (this: ScenarioWorld, name: string) {
  await this.driver.expectLiveFlag(name, false);
});

When("I select {string} in the source", async function (this: ScenarioWorld, text: string) {
  await this.driver.selectSourceText(text);
});

When("I wrap the selection with the {string} live flag", async function (this: ScenarioWorld, name: string) {
  await this.driver.wrapSelectionWith(name);
});

When("I create the named view {string}", async function (this: ScenarioWorld, name: string) {
  await this.driver.createView(name);
});

When("I switch to the named view {string}", async function (this: ScenarioWorld, name: string) {
  await this.driver.switchView(name);
});

When("I rename the active view to {string}", async function (this: ScenarioWorld, name: string) {
  await this.driver.renameView(name);
});

When("I click the {string} class", async function (this: ScenarioWorld, name: string) {
  await this.driver.clickClass(name);
});

Then("the diagram is wider than 4096 pixels", async function (this: ScenarioWorld) {
  await this.driver.rememberDiagramWidth();
});

Then("the previous diagram width is preserved", async function (this: ScenarioWorld) {
  await this.driver.expectDiagramWidthPreserved();
});

Then("the runtime network APIs are blocked", async function (this: ScenarioWorld) {
  await this.driver.expectNetworkApisBlocked();
});
