import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const external = [
  "vscode",
  "@cucumber/cucumber",
  "@cucumber/cucumber/api",
  "@playwright/test",
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
];

export default defineConfig({
  build: {
    target: "node20",
    outDir: resolve(".scenario-dist"),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: {
        web: resolve("user-scenarios/support/web/support.ts"),
        vscode: resolve("user-scenarios/support/vscode/support.ts"),
        "vscode-runner": resolve(
          "user-scenarios/support/vscode/runner.ts",
        ),
      },
      formats: ["cjs"],
    },
    rollupOptions: {
      external,
      output: {
        entryFileNames: "[name].cjs",
        chunkFileNames: "chunks/[name]-[hash].cjs",
      },
    },
  },
});
