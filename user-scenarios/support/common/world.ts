import { World, type IWorldOptions } from "@cucumber/cucumber";
import type { RenderSnapshot, ScenarioDriver } from "./driver";

export interface ScenarioWorldParameters {
  browserName?: "chromium" | "firefox";
}

export class ScenarioWorld extends World<ScenarioWorldParameters> {
  driver: ScenarioDriver;
  latestSource: string | undefined;
  rememberedRender: RenderSnapshot | undefined;

  constructor(
    options: IWorldOptions<ScenarioWorldParameters>,
    driver: ScenarioDriver,
  ) {
    super(options);
    this.driver = driver;
  }

  requireLatestSource() {
    if (this.latestSource === undefined) {
      throw new Error("No PlantUML source has been supplied in this scenario.");
    }
    return this.latestSource;
  }

  requireRememberedRender() {
    if (!this.rememberedRender) {
      throw new Error("The scenario did not remember a diagram before comparing it.");
    }
    return this.rememberedRender;
  }
}
