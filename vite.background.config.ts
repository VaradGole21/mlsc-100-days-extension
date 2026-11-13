import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  configFile: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "esnext",
    rollupOptions: {
      input: resolve(__dirname, "src/background.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "background.js",
      },
    },
  },
});
