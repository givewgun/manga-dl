import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stageDir = path.join(root, "release", "stage");
const mangadlNodeModules = path.join(stageDir, "node_modules", "@mangadl");

const packages = [
  {
    name: "@mangadl/core",
    dir: "core",
    dependencies: {}
  },
  {
    name: "@mangadl/downloader",
    dir: "downloader",
    dependencies: {
      "@mangadl/core": "0.1.0",
      yazl: "^3.3.1"
    }
  },
  {
    name: "@mangadl/persistence",
    dir: "persistence",
    dependencies: {
      "@mangadl/core": "0.1.0",
      "@mangadl/downloader": "0.1.0"
    }
  },
  {
    name: "@mangadl/sources",
    dir: "sources",
    dependencies: {
      "@mangadl/core": "0.1.0",
      cheerio: "^1.1.2"
    }
  }
];

await fs.mkdir(mangadlNodeModules, { recursive: true });

for (const pkg of packages) {
  const sourceDir = path.join(root, "packages", pkg.dir);
  const targetDir = path.join(mangadlNodeModules, pkg.dir);
  const sourcePackage = await readJson(path.join(sourceDir, "package.json"));

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(path.join(sourceDir, "dist"), path.join(targetDir, "dist"), { recursive: true });
  await fs.writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify({
      name: pkg.name,
      version: sourcePackage.version,
      private: true,
      type: "module",
      main: "dist/index.js",
      exports: sourcePackage.exports,
      dependencies: pkg.dependencies
    }, null, 2)}\n`
  );
}

const stagePackagePath = path.join(stageDir, "package.json");
const stagePackage = await readJson(stagePackagePath);
stagePackage.dependencies = {
  ...Object.fromEntries(packages.map((pkg) => [pkg.name, "0.1.0"])),
  cheerio: stagePackage.dependencies.cheerio,
  yazl: stagePackage.dependencies.yazl
};
await fs.writeFile(stagePackagePath, `${JSON.stringify(stagePackage, null, 2)}\n`);

console.log("Vendored workspace packages into release/stage/node_modules/@mangadl");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
