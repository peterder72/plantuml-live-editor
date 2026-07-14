import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface PackageManifest {
  version?: string;
  [key: string]: unknown;
}

const rootPath = resolve("package.json");
const extensionPath = resolve("vscode/package.json");
const [rootText, extensionText] = await Promise.all([
  readFile(rootPath, "utf8"),
  readFile(extensionPath, "utf8"),
]);
const root = JSON.parse(rootText) as PackageManifest;
const extension = JSON.parse(extensionText) as PackageManifest;

if (!root.version) throw new Error("Root package.json has no version.");

if (extension.version !== root.version) {
  extension.version = root.version;
  await writeFile(extensionPath, `${JSON.stringify(extension, null, 2)}\n`);
  console.log(`Synchronized VS Code extension version to ${root.version}.`);
} else {
  console.log(`VS Code extension version is already ${root.version}.`);
}
