import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const extensionPath = resolve("vscode/dist/extension.cjs");
const webviewPath = resolve("vscode/dist/webview/webview.js");
const stylePath = resolve("vscode/dist/webview/style.css");

const [extension, webview, extensionStats, webviewStats, styleStats] =
  await Promise.all([
    readFile(extensionPath, "utf8"),
    readFile(webviewPath, "utf8"),
    stat(extensionPath),
    stat(webviewPath),
    stat(stylePath),
  ]);

for (const marker of [
  "plantumlLive.openPreview",
  "retainContextWhenHidden",
  "Content-Security-Policy",
  "wasm-unsafe-eval",
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
]) {
  if (!webview.includes(marker)) {
    throw new Error(`Webview bundle is missing: ${marker}`);
  }
}

if (/\bprocess\.env\b/.test(webview)) {
  throw new Error("Webview bundle contains an unresolved process.env reference.");
}

console.log(
  [
    "Verified VS Code build:",
    `extension ${(extensionStats.size / 1024).toFixed(1)} KiB,`,
    `webview ${(webviewStats.size / 1024 / 1024).toFixed(2)} MiB,`,
    `styles ${(styleStats.size / 1024).toFixed(1)} KiB`,
  ].join(" "),
);
