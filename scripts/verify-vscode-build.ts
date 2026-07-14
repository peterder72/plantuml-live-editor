import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const extensionPath = resolve("vscode/dist/extension.cjs");
const webviewPath = resolve("vscode/dist/webview/webview.js");
const stylePath = resolve("vscode/dist/webview/style.css");
const iconPath = resolve("vscode/images/icon.png");

const [
  extension,
  webview,
  extensionStats,
  webviewStats,
  styleStats,
  rootManifestText,
  extensionManifestText,
  icon,
] =
  await Promise.all([
    readFile(extensionPath, "utf8"),
    readFile(webviewPath, "utf8"),
    stat(extensionPath),
    stat(webviewPath),
    stat(stylePath),
    readFile(resolve("package.json"), "utf8"),
    readFile(resolve("vscode/package.json"), "utf8"),
    readFile(iconPath),
  ]);

const rootManifest = JSON.parse(rootManifestText) as { version?: string };
const extensionManifest = JSON.parse(extensionManifestText) as {
  name?: string;
  displayName?: string;
  version?: string;
  publisher?: string;
  icon?: string;
  repository?: { url?: string };
  homepage?: string;
  bugs?: { url?: string };
  galleryBanner?: { color?: string; theme?: string };
  capabilities?: Record<string, unknown>;
  files?: string[];
};

if (extensionManifest.version !== rootManifest.version) {
  throw new Error(
    `Extension version ${extensionManifest.version} does not match root version ${rootManifest.version}.`,
  );
}

const requiredMetadata: Array<[string, unknown]> = [
  ["name", extensionManifest.name === "plantuml-live-editor"],
  ["displayName", extensionManifest.displayName === "PlantUML Live Editor"],
  ["publisher", extensionManifest.publisher === "peterder72"],
  ["icon", extensionManifest.icon === "images/icon.png"],
  ["repository", extensionManifest.repository?.url],
  ["homepage", extensionManifest.homepage],
  ["bugs", extensionManifest.bugs?.url],
  ["galleryBanner", extensionManifest.galleryBanner?.color],
  ["capabilities", extensionManifest.capabilities],
];
for (const [field, value] of requiredMetadata) {
  if (!value) throw new Error(`Extension manifest is missing valid ${field} metadata.`);
}

for (const packagedFile of [
  "dist",
  "images/icon.png",
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
  "SUPPORT.md",
  "THIRD_PARTY_NOTICES.md",
]) {
  if (!extensionManifest.files?.includes(packagedFile)) {
    throw new Error(`Extension files list is missing: ${packagedFile}`);
  }
}

if (
  icon.subarray(1, 4).toString("ascii") !== "PNG" ||
  icon.readUInt32BE(16) !== 256 ||
  icon.readUInt32BE(20) !== 256
) {
  throw new Error("Extension icon must be a 256 x 256 PNG.");
}

for (const marker of [
  "plantumlLive.openPreview",
  "retainContextWhenHidden",
  "Content-Security-Policy",
  "wasm-unsafe-eval",
  "onDidChangeTextEditorSelection",
  "selectionAfter",
  "revealRange",
]) {
  if (!extension.includes(marker)) {
    throw new Error(`Extension bundle is missing: ${marker}`);
  }
}

for (const marker of [
  "data:application/octet-stream;base64,",
  "Includes, imports, and external themes are disabled for privacy.",
  "unsafe external SVG resource",
  "Network access is disabled by PlantUML Live Editor",
  "selectionAfter",
]) {
  if (!webview.includes(marker)) {
    throw new Error(`Webview bundle is missing: ${marker}`);
  }
}

if (/\bprocess\.env\b/.test(webview)) {
  throw new Error("Webview bundle contains an unresolved process.env reference.");
}

const distFiles = (await readdir(resolve("vscode/dist"), {
  recursive: true,
  withFileTypes: true,
}))
  .filter((entry) => entry.isFile())
  .map((entry) => {
    const parent = entry.parentPath.replace(`${resolve("vscode/dist")}/`, "");
    return parent === resolve("vscode/dist") ? entry.name : `${parent}/${entry.name}`;
  })
  .sort();
const expectedDistFiles = [
  "extension.cjs",
  "webview/style.css",
  "webview/webview.js",
];
if (JSON.stringify(distFiles) !== JSON.stringify(expectedDistFiles)) {
  throw new Error(`Unexpected VS Code dist contents: ${distFiles.join(", ")}`);
}

console.log(
  [
    "Verified VS Code build:",
    `extension ${(extensionStats.size / 1024).toFixed(1)} KiB,`,
    `webview ${(webviewStats.size / 1024 / 1024).toFixed(2)} MiB,`,
    `styles ${(styleStats.size / 1024).toFixed(1)} KiB`,
  ].join(" "),
);
