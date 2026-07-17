import { Given, Then, When } from "@cucumber/cucumber";
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

Then(
  "the editor contains that PlantUML source",
  async function (this: ScenarioWorld) {
    await this.driver.expectSource(this.requireLatestSource());
  },
);

Then("the diagram is rerendered", async function (this: ScenarioWorld) {
  await this.driver.expectRenderChanged(this.requireRememberedRender());
});
