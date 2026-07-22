import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadChangelog,
  renderChangelogMarkdown,
} from "./changelog";

const changelog = await loadChangelog();
const manifest = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  version?: string;
};
if (changelog.releases[0].version !== manifest.version) {
  throw new Error(
    `Latest changelog version ${changelog.releases[0].version} does not match package version ${String(manifest.version)}.`,
  );
}
const outputPath = resolve("vscode/CHANGELOG.md");
const output = renderChangelogMarkdown(changelog);
const current = await readFile(outputPath, "utf8").catch(() => "");

if (current === output) {
  console.log("VS Code changelog is already synchronized.");
} else {
  await writeFile(outputPath, output);
  console.log("Synchronized VS Code changelog from CHANGELOG.json.");
}
