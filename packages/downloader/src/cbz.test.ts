import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCbz } from "./cbz.js";

describe("createCbz", () => {
  it("creates a non-empty archive", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mangadl-cbz-"));
    const page = path.join(dir, "0001.jpg");
    const cbz = path.join(dir, "chapter.cbz");
    await writeFile(page, Buffer.from([1, 2, 3, 4]));
    await createCbz(dir, [page], cbz);
    expect((await stat(cbz)).size).toBeGreaterThan(0);
  });
});
