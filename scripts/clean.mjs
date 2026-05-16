import { rm } from "node:fs/promises";

const targets = [
  "node_modules",
  "dist",
  "coverage",
  "release",
  "packages/core/dist",
  "packages/sources/dist",
  "packages/downloader/dist",
  "packages/persistence/dist",
  "apps/desktop/dist",
  "apps/desktop/dist-renderer",
  "apps/desktop/dist-renderer-types"
];

await Promise.all(targets.map((target) => rm(target, { recursive: true, force: true })));
