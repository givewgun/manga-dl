import { createWriteStream } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { ZipFile } from "yazl";

export async function createCbz(chapterDir: string, imageFiles: string[], outputPath: string): Promise<void> {
  if (imageFiles.length === 0) return;

  const tempPath = `${outputPath}.part`;
  await rm(tempPath, { force: true });

  await new Promise<void>((resolve, reject) => {
    const zip = new ZipFile();
    const output = createWriteStream(tempPath);
    output.on("close", resolve);
    output.on("error", reject);
    zip.outputStream.on("error", reject);
    zip.outputStream.pipe(output);

    for (const filePath of imageFiles) {
      zip.addFile(filePath, path.relative(chapterDir, filePath).replaceAll("\\", "/"));
    }

    zip.end();
  });

  const file = await stat(tempPath);
  if (file.size === 0) {
    await rm(tempPath, { force: true });
    throw new Error("CBZ generation produced an empty archive");
  }

  await rename(tempPath, outputPath);
}
