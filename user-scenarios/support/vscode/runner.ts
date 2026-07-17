import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";
import { resolve } from "node:path";

async function run() {
  const projectRoot = resolve(__dirname, "..");
  const environment = { cwd: projectRoot };
  const { runConfiguration } = await loadConfiguration(
    {
      file: "cucumber.mjs",
      profiles: ["vscode"],
    },
    environment,
  );
  const result = await runCucumber(runConfiguration, environment);
  if (!result.success) throw new Error("VS Code Cucumber scenarios failed.");
}

export { run };
