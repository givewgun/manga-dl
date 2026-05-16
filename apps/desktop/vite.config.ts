import { defineConfig } from "vite";

export default defineConfig({
  root: "src/renderer",
  base: "./",
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  build: {
    outDir: "../../dist-renderer",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: false
  }
});
