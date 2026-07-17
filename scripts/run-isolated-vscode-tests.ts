import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "@vscode/test-electron";

interface IsolatedVSCodeTestOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs?: string[];
}

export async function runIsolatedVSCodeTests({
  extensionDevelopmentPath,
  extensionTestsPath,
  launchArgs = [],
}: IsolatedVSCodeTestOptions) {
  // VS Code creates a Unix socket below user-data-dir. macOS's default temporary
  // directory is long enough to exceed the platform's socket path limit.
  const temporaryRoot = process.platform === "darwin" ? "/tmp" : tmpdir();
  const profileRoot = await mkdtemp(
    join(temporaryRoot, "pu-vscode-test-"),
  );

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        `--user-data-dir=${join(profileRoot, "user-data")}`,
        `--extensions-dir=${join(profileRoot, "extensions")}`,
        ...launchArgs,
      ],
    });
  } finally {
    await rm(profileRoot, { recursive: true, force: true });
  }
}
