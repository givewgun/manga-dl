import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const desktopDir = path.join(root, "apps", "desktop");
const stageDir = path.join(root, "release", "stage");

const rootPackage = await readJson(path.join(root, "package.json"));
const desktopPackage = await readJson(path.join(desktopDir, "package.json"));
const electronVersion = exactVersion(desktopPackage.dependencies.electron);

await fs.rm(stageDir, { recursive: true, force: true });
await fs.mkdir(stageDir, { recursive: true });
await fs.cp(path.join(desktopDir, "dist"), path.join(stageDir, "dist"), { recursive: true });
await fs.cp(path.join(desktopDir, "dist-renderer"), path.join(stageDir, "dist-renderer"), { recursive: true });

const stagePackage = {
  name: "mangadl",
  version: rootPackage.version,
  private: true,
  type: "module",
  main: "dist/main/main.js",
  description: rootPackage.description,
  author: rootPackage.author,
  dependencies: {
    cheerio: desktopPackage.dependencies.cheerio ?? "^1.1.2",
    yazl: desktopPackage.dependencies.yazl ?? "^3.3.1"
  },
  build: {
    appId: "com.givewgun.mangadl",
    productName: "MangaDL",
    electronVersion,
    asar: true,
    directories: {
      output: "../dist"
    },
    files: ["dist/**", "dist-renderer/**", "node_modules/**", "package.json"],
    win: {
      signAndEditExecutable: false,
      target: [
        {
          target: "nsis",
          arch: ["x64"]
        },
        {
          target: "portable",
          arch: ["x64"]
        }
      ]
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true
    },
    publish: [
      {
        provider: "github",
        owner: "givewgun",
        repo: "manga-dl"
      }
    ]
  }
};

await fs.writeFile(path.join(stageDir, "package.json"), `${JSON.stringify(stagePackage, null, 2)}\n`);

console.log(`Prepared Electron Builder staging app at ${path.relative(root, stageDir)}`);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function exactVersion(range) {
  if (!range) return undefined;
  return range.replace(/^[^\d]*/, "");
}
