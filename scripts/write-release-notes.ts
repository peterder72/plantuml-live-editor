import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadChangelog,
  renderReleaseNotesMarkdown,
} from "./changelog";

const [version, outputArgument] = process.argv.slice(2);
if (!version || !outputArgument) {
  throw new Error(
    "Usage: bun scripts/write-release-notes.ts <version> <output-path>",
  );
}

const outputPath = resolve(outputArgument);
const notes = renderReleaseNotesMarkdown(await loadChangelog(), version);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, notes);
console.log(`Wrote release notes for ${version} to ${outputArgument}.`);
