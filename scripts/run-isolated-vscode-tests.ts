import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

interface IsolatedVSCodeTestOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs?: string[];
  version?: string;
  diagnosticsName: string;
}

const DEFAULT_VSCODE_TEST_VERSION = (
  await readFile(resolve(".vscode-test-version"), "utf8")
).trim();
const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_IDLE_TIMEOUT = 60_000;

export async function runIsolatedVSCodeTests({
  extensionDevelopmentPath,
  extensionTestsPath,
  launchArgs = [],
  version = DEFAULT_VSCODE_TEST_VERSION,
  diagnosticsName,
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
    const vscodeExecutablePath = await downloadVSCode(version);
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath,
      extensionTestsEnv: {
        PLANTUML_TEST_WORKSPACE: workspaceDir,
      },
      launchArgs: [
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${join(profileRoot, "extensions")}`,
        "--disable-extensions",
        "--skip-welcome",
        "--skip-release-notes",
        ...launchArgs,
      ],
    });
  } catch (error) {
    await preserveDiagnostics(userDataDir, diagnosticsName);
    throw error;
  } finally {
    await rm(profileRoot, { recursive: true, force: true });
  }
}

async function downloadVSCode(version: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await downloadAndUnzipVSCode({
        version,
        timeout: DOWNLOAD_IDLE_TIMEOUT,
      });
    } catch (error) {
      lastError = error;
      if (attempt === DOWNLOAD_ATTEMPTS) break;
      console.warn(
        `VS Code ${version} download attempt ${attempt} failed; retrying download only.`,
      );
      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, attempt * 1_000),
      );
    }
  }
  throw lastError;
}

async function preserveDiagnostics(userDataDir: string, diagnosticsName: string) {
  const source = join(userDataDir, "logs");
  const destination = resolve("test-results", "vscode", diagnosticsName);
  try {
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true });
    console.error(`Preserved VS Code diagnostics at ${destination}`);
  } catch (error) {
    if (isMissingFileError(error)) return;
    console.error(`Could not preserve VS Code diagnostics: ${String(error)}`);
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
