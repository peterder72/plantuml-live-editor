import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'none'",
  "connect-src 'none'",
  "img-src data: blob:",
  "font-src 'none'",
  "media-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

const distPath = resolve("dist");
const entries = await readdir(distPath);

if (entries.length !== 1 || entries[0] !== "index.html") {
  throw new Error(
    `Expected dist/index.html to be the only artifact, found: ${entries.join(", ")}`,
  );
}

const htmlPath = resolve(distPath, "index.html");
const html = await readFile(htmlPath, "utf8");
const cspMatch = html.match(
  /<meta\s+http-equiv=(["'])Content-Security-Policy\1\s+content=(["'])(.*?)\2/i,
);
if (!cspMatch) {
  throw new Error("Content Security Policy meta element was not found.");
}
const csp = cspMatch[3]
  .replaceAll("&#39;", "'")
  .replaceAll("&quot;", '"')
  .replaceAll("&amp;", "&");
for (const directive of REQUIRED_CSP_DIRECTIVES) {
  if (!csp.includes(directive)) {
    throw new Error(`Content Security Policy is missing: ${directive}`);
  }
}

const cspIndex = html.indexOf(cspMatch[0]);
const firstScriptIndex = html.search(/<script\b/i);
if (firstScriptIndex >= 0 && cspIndex > firstScriptIndex) {
  throw new Error("Content Security Policy must precede every script.");
}

const documentMarkup = html
  .replace(
    /<script\b([^>]*)>[\s\S]*?<\/script>/gi,
    (_match, attributes: string) => `<script${attributes}></script>`,
  )
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>");
const forbidden = [
  /<script[^>]+src=/i,
  /<link[^>]+rel=["']stylesheet["'][^>]+href=/i,
  /<img[^>]+src=(?!["']data:)/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<form\b/i,
  /<link[^>]+rel=["'](?:preload|prefetch|dns-prefetch|modulepreload|manifest)["']/i,
  /new\s+Worker\s*\(\s*["'][^"']+["']/i,
];

for (const pattern of forbidden) {
  if (pattern.test(documentMarkup)) {
    throw new Error(`Single-file verification failed for pattern ${pattern}`);
  }
}

if (!html.includes("data:application/octet-stream;base64,")) {
  throw new Error("Embedded Graphviz WASM payload was not found.");
}

for (const marker of [
  "Network access is disabled by PlantUML Live Editor",
  "Includes, imports, and external themes are disabled for privacy.",
  "unsafe external SVG resource",
]) {
  if (!html.includes(marker)) {
    throw new Error(`Security control was not found in the bundle: ${marker}`);
  }
}

const size = (await stat(htmlPath)).size;
const sha256 = createHash("sha256").update(html).digest("hex");
console.log(
  `Verified zero-egress single-file build: dist/index.html (${(size / 1024 / 1024).toFixed(2)} MiB, sha256 ${sha256})`,
);
