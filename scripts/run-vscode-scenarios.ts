import { resolve } from "node:path";
import { runTests } from "@vscode/test-electron";

await runTests({
  extensionDevelopmentPath: resolve("vscode"),
  extensionTestsPath: resolve(".scenario-dist/vscode-runner.cjs"),
  launchArgs: ["--disable-extensions"],
});
