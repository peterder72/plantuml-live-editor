import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";

const DOWNLOAD_IDLE_TIMEOUT = 60_000;
const testEntryPoint = process.argv[2];

if (!testEntryPoint) {
  throw new Error("Expected a Bun test entry point.");
}

const version = (await readFile(resolve(".vscode-test-version"), "utf8")).trim();

if (!version) {
  throw new Error(".vscode-test-version must contain a pinned VS Code version.");
}

// Provisioning is intentionally isolated from the Bun test process. A recovered
// archive extraction failure can otherwise leave Bun with a non-zero process
// status even after @vscode/test-electron retries and the tests pass.
const vscodeExecutablePath = await downloadAndUnzipVSCode({
  version,
  timeout: DOWNLOAD_IDLE_TIMEOUT,
});

const exitCode = await runBunTest(testEntryPoint, vscodeExecutablePath);
process.exitCode = exitCode;

function runBunTest(entryPoint, executablePath) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [entryPoint], {
      stdio: "inherit",
      env: {
        ...process.env,
        VSCODE_TEST_EXECUTABLE_PATH: executablePath,
      },
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`VS Code test process terminated with signal ${signal}.`));
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}
