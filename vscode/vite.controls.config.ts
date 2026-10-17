import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    target: "es2022",
    outDir: resolve(currentDirectory, "dist/controls"),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: {
      entry: resolve(currentDirectory, "../src/vscode/controls-main.tsx"),
      formats: ["iife"],
      fileName: () => "controls.js",
      cssFileName: "style",
      name: "PlantUmlLiveControls",
    },
  },
});
