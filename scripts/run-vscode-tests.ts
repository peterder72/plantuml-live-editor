import { resolve } from "node:path";
import { runIsolatedVSCodeTests } from "./run-isolated-vscode-tests";

await runIsolatedVSCodeTests({
  extensionDevelopmentPath: resolve("vscode"),
  extensionTestsPath: resolve("vscode/test/suite/index.cjs"),
});
