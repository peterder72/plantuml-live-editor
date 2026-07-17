import { After } from "@cucumber/cucumber";
import type { ScenarioWorld } from "../common/world";

After(async function (this: ScenarioWorld) {
  await this.driver.dispose();
});
