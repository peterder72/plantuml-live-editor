import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    target: "node20",
    outDir: resolve(currentDirectory, "dist"),
    emptyOutDir: true,
    lib: {
      entry: resolve(currentDirectory, "src/extension.ts"),
      formats: ["cjs"],
      fileName: () => "extension.cjs",
    },
    rollupOptions: {
      external: ["vscode"],
    },
    minify: false,
    sourcemap: false,
  },
});
