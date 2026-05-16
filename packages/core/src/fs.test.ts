import { describe, expect, it } from "vitest";
import { chapterLabel, inferExtensionFromUrl, numberedPageFilename, sanitizePathSegment } from "./fs.js";

describe("filesystem helpers", () => {
  it("sanitizes Windows-hostile path segments", () => {
    expect(sanitizePathSegment("A:B/C*D? <E>")).toBe("A B C D E");
    expect(sanitizePathSegment("con")).toBe("con_");
    expect(sanitizePathSegment("   ")).toBe("untitled");
  });

  it("builds stable chapter labels", () => {
    expect(chapterLabel({ chapterId: "abc", volume: "2", chapter: "15", title: "Arrival" })).toBe(
      "v2 - c15 - Arrival"
    );
  });

  it("formats page filenames and image extensions", () => {
    expect(numberedPageFilename(0, ".jpg")).toBe("0001.jpg");
    expect(inferExtensionFromUrl("https://x.test/page.webp")).toBe(".webp");
    expect(inferExtensionFromUrl("https://x.test/page", "image/png")).toBe(".png");
  });
});
