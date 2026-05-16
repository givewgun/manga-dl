import { rm } from "node:fs/promises";

const targets = [
  "node_modules",
  "dist",
  "coverage",
  "packages/core/dist",
  "packages/sources/dist",
  "packages/downloader/dist",
  "packages/persistence/dist",
  "apps/desktop/dist",
  "apps/desktop/dist-renderer"
];

await Promise.all(targets.map((target) => rm(target, { recursive: true, force: true })));
