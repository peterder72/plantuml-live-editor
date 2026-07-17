import {
  setDefaultTimeout,
  setWorldConstructor,
  type IWorldOptions,
} from "@cucumber/cucumber";
import "../common/steps";
import { ScenarioWorld, type ScenarioWorldParameters } from "../common/world";
import { WebScenarioDriver } from "./driver";
import "./hooks";

class WebScenarioWorld extends ScenarioWorld {
  constructor(options: IWorldOptions<ScenarioWorldParameters>) {
    const browserName = options.parameters.browserName;
    if (browserName !== "chromium" && browserName !== "firefox") {
      throw new Error(`Unsupported scenario browser: ${String(browserName)}`);
    }
    super(options, new WebScenarioDriver(browserName));
  }
}

setDefaultTimeout(60_000);
setWorldConstructor(WebScenarioWorld);
