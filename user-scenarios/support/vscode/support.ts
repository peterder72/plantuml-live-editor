import {
  setDefaultTimeout,
  setWorldConstructor,
  type IWorldOptions,
} from "@cucumber/cucumber";
import "../common/steps";
import { ScenarioWorld, type ScenarioWorldParameters } from "../common/world";
import { VsCodeScenarioDriver } from "./driver";
import "./hooks";
import "./steps";

class VsCodeScenarioWorld extends ScenarioWorld {
  constructor(options: IWorldOptions<ScenarioWorldParameters>) {
    super(options, new VsCodeScenarioDriver());
  }
}

setDefaultTimeout(60_000);
setWorldConstructor(VsCodeScenarioWorld);
