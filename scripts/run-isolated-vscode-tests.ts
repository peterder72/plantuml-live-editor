import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTests } from "@vscode/test-electron";

interface IsolatedVSCodeTestOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs?: string[];
  version?: string;
}

const DEFAULT_VSCODE_TEST_VERSION = "1.129.0";

export async function runIsolatedVSCodeTests({
  extensionDevelopmentPath,
  extensionTestsPath,
  launchArgs = [],
  version = DEFAULT_VSCODE_TEST_VERSION,
}: IsolatedVSCodeTestOptions) {
  // VS Code creates a Unix socket below user-data-dir. macOS's default temporary
  // directory is long enough to exceed the platform's socket path limit.
  const temporaryRoot = process.platform === "darwin" ? "/tmp" : tmpdir();
  const profileRoot = await mkdtemp(
    join(temporaryRoot, "pu-vscode-test-"),
  );
  const userDataDir = join(profileRoot, "user-data");
  const workspaceDir = join(profileRoot, "workspace");

  try {
    await mkdir(join(userDataDir, "User"), { recursive: true });
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(
      join(userDataDir, "User", "settings.json"),
      JSON.stringify({
        "files.hotExit": "off",
        "security.workspace.trust.enabled": false,
        "telemetry.telemetryLevel": "off",
        "workbench.localHistory.enabled": false,
        "workbench.startupEditor": "none",
      }),
    );
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      version,
      extensionTestsEnv: {
        PLANTUML_TEST_WORKSPACE: workspaceDir,
      },
      launchArgs: [
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${join(profileRoot, "extensions")}`,
        ...launchArgs,
      ],
    });
  } finally {
    await rm(profileRoot, { recursive: true, force: true });
  }
}
