import { resolve } from "node:path";
import { runTests } from "@vscode/test-electron";

await runTests({
  extensionDevelopmentPath: resolve("vscode"),
  extensionTestsPath: resolve("vscode/test/suite/index.cjs"),
});
