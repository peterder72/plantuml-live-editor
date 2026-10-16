import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Build the working checkout, including uncommitted changes, not the flake source.
const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (manifest.name !== "plantuml-live-editor") {
  throw new Error("Run this command from the plantuml-live-editor repository root.");
}
const code = process.env.PLANTUML_VSCODE_CLI ?? "code";
const profile = await mkdtemp(join(process.platform === "darwin" ? "/tmp" : tmpdir(), "pu-code-"));
const userData = join(profile, "user-data");
const extensionDir = join(profile, "extensions");
const vsix = join(profile, "plantuml-live-editor.vsix");
const isolation = [`--user-data-dir=${userData}`, `--extensions-dir=${extensionDir}`];

async function run(command: string, args: string[], cwd = root) {
  await new Promise<void>((resolvePromise, reject) => {
    // Avoid inheriting another VS Code instance's IPC routing.
    const env = { ...process.env };
    delete env.VSCODE_IPC_HOOK_CLI;
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(command, args, { cwd, stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", (status, signal) => {
      if (status === 0) resolvePromise();
      else reject(new Error(`${command} failed (${signal ?? status}).`));
    });
  });
}

try {
  await run("bun", ["install", "--frozen-lockfile"]);
  await run("bun", ["run", "build:vscode"]);
  await run("bun", ["x", "--no-install", "vsce", "package", "--no-dependencies", "--out", vsix], join(root, "vscode"));
  await mkdir(join(userData, "User"), { recursive: true });
  await writeFile(join(userData, "User", "settings.json"), JSON.stringify({
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoCheckUpdates": false,
    "extensions.autoUpdate": false,
    "workbench.enableExperiments": false,
    "workbench.startupEditor": "none",
  }));
  await run(code, [...isolation, "--install-extension", vsix, "--force"]);
  const targets = process.argv.slice(2);
  console.log("Launching a fresh VS Code profile; close its window to clean up.");
  await run(code, [...isolation, "--new-window", "--wait", "--skip-welcome", "--skip-release-notes",
    ...(targets.length ? targets.map((target) => resolve(target)) : [join(root, "examples"), join(root, "examples", "shop.puml")])]);
} finally {
  await rm(profile, { recursive: true, force: true });
}
