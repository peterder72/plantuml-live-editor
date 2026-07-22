import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { listFiles, PackageManager } from "@vscode/vsce";
import {
  loadChangelog,
  renderChangelogMarkdown,
} from "./changelog";

const extensionPath = resolve("vscode/dist/extension.cjs");
const webviewPath = resolve("vscode/dist/webview/webview.js");
const stylePath = resolve("vscode/dist/webview/style.css");
const iconPath = resolve("vscode/images/icon.png");
const grammarPath = resolve("vscode/syntaxes/plantuml.tmLanguage.json");
const languageConfigurationPath = resolve("vscode/language-configuration.json");
const grammarLicensePath = resolve("vscode/syntaxes/LICENSE.qjebbs.txt");

const [
  extension,
  webview,
  extensionStats,
  webviewStats,
  styleStats,
  rootManifestText,
  extensionManifestText,
  icon,
  grammarText,
  languageConfigurationText,
  grammarLicenseText,
  extensionChangelog,
  changelog,
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
    readFile(grammarPath, "utf8"),
    readFile(languageConfigurationPath, "utf8"),
    readFile(grammarLicensePath, "utf8"),
    readFile(resolve("vscode/CHANGELOG.md"), "utf8"),
    loadChangelog(),
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
  contributes?: {
    languages?: Array<{
      id?: string;
      extensions?: string[];
      configuration?: string;
    }>;
    grammars?: Array<{
      language?: string;
      scopeName?: string;
      path?: string;
    }>;
  };
};

if (extensionManifest.version !== rootManifest.version) {
  throw new Error(
    `Extension version ${extensionManifest.version} does not match root version ${rootManifest.version}.`,
  );
}
if (changelog.releases[0].version !== rootManifest.version) {
  throw new Error(
    `Latest changelog version ${changelog.releases[0].version} does not match root version ${String(rootManifest.version)}.`,
  );
}
if (extensionChangelog !== renderChangelogMarkdown(changelog)) {
  throw new Error("VS Code changelog is not synchronized with CHANGELOG.json.");
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
  "syntaxes",
  "language-configuration.json",
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

const expectedPlantUmlExtensions = [
  ".puml",
  ".plantuml",
  ".pu",
  ".iuml",
  ".wsd",
];
const plantUmlLanguage = extensionManifest.contributes?.languages?.find(
  (language) => language.id === "plantuml",
);
if (
  !plantUmlLanguage ||
  JSON.stringify(plantUmlLanguage.extensions) !==
    JSON.stringify(expectedPlantUmlExtensions) ||
  plantUmlLanguage.configuration !== "./language-configuration.json"
) {
  throw new Error("Extension manifest has an invalid PlantUML language contribution.");
}

const plantUmlGrammar = extensionManifest.contributes?.grammars?.find(
  (grammar) => grammar.language === "plantuml",
);
if (
  !plantUmlGrammar ||
  plantUmlGrammar.scopeName !== "source.wsd" ||
  plantUmlGrammar.path !== "./syntaxes/plantuml.tmLanguage.json"
) {
  throw new Error("Extension manifest has an invalid PlantUML grammar contribution.");
}

const grammar = JSON.parse(grammarText) as {
  scopeName?: string;
  patterns?: unknown[];
};
if (grammar.scopeName !== "source.wsd" || !grammar.patterns?.length) {
  throw new Error("PlantUML TextMate grammar is missing its scope or patterns.");
}

const languageConfiguration = JSON.parse(languageConfigurationText) as {
  comments?: { lineComment?: string; blockComment?: string[] };
  folding?: { markers?: { start?: string; end?: string } };
  brackets?: unknown[];
  autoClosingPairs?: unknown[];
};
if (
  languageConfiguration.comments?.lineComment !== "'" ||
  languageConfiguration.comments.blockComment?.join("") !== "/''/" ||
  !languageConfiguration.folding?.markers?.start ||
  !languageConfiguration.folding.markers.end ||
  !languageConfiguration.brackets?.length ||
  !languageConfiguration.autoClosingPairs?.length
) {
  throw new Error("PlantUML language configuration is incomplete.");
}

const foldingStart = new RegExp(languageConfiguration.folding.markers.start);
const foldingEnd = new RegExp(languageConfiguration.folding.markers.end);

for (const line of ["!if condition", "  !IF condition", "\t!If condition"]) {
  if (!foldingStart.test(line)) {
    throw new Error(`PlantUML folding start marker does not match: ${line}`);
  }
}
for (const line of ["!endif", "  !ENDIF", "\t!EndIf"]) {
  if (!foldingEnd.test(line)) {
    throw new Error(`PlantUML folding end marker does not match: ${line}`);
  }
}
for (const line of ["!else", "!elseif condition", "!ifdef FLAG", "!ifndef FLAG"]) {
  if (foldingStart.test(line) || foldingEnd.test(line)) {
    throw new Error(`PlantUML folding marker unexpectedly matches: ${line}`);
  }
}

const nestedFoldingLines = [
  "!if outer",
  "  !if inner",
  "  !endif",
  "!endif",
];
const foldingStack: number[] = [];
const foldingRanges: Array<[number, number]> = [];
for (const [lineNumber, line] of nestedFoldingLines.entries()) {
  if (foldingStart.test(line)) foldingStack.push(lineNumber);
  if (foldingEnd.test(line)) {
    const start = foldingStack.pop();
    if (start !== undefined) foldingRanges.push([start, lineNumber]);
  }
}
if (
  foldingStack.length !== 0 ||
  JSON.stringify(foldingRanges) !== JSON.stringify([[1, 2], [0, 3]])
) {
  throw new Error("PlantUML folding markers do not preserve nested ranges.");
}

if (
  !grammarLicenseText.includes("Copyright (c) 2016 jebbs") ||
  !grammarLicenseText.includes("The MIT License")
) {
  throw new Error("PlantUML grammar license notice is incomplete.");
}

const packageFiles = await listFiles({
  cwd: resolve("vscode"),
  packageManager: PackageManager.None,
});
for (const requiredPackageFile of [
  "language-configuration.json",
  "syntaxes/LICENSE.qjebbs.txt",
  "syntaxes/plantuml.tmLanguage.json",
  "THIRD_PARTY_NOTICES.md",
]) {
  if (!packageFiles.includes(requiredPackageFile)) {
    throw new Error(`VSIX contents are missing: ${requiredPackageFile}`);
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
