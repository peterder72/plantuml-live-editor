import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const distPath = resolve("dist");
const entries = await readdir(distPath);

if (entries.length !== 1 || entries[0] !== "index.html") {
  throw new Error(
    `Expected dist/index.html to be the only artifact, found: ${entries.join(", ")}`,
  );
}

const htmlPath = resolve(distPath, "index.html");
const html = await readFile(htmlPath, "utf8");
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

const size = (await stat(htmlPath)).size;
console.log(
  `Verified offline single-file build: dist/index.html (${(size / 1024 / 1024).toFixed(2)} MiB)`,
);
