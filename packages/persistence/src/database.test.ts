import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AppDatabase } from "./database.js";

describe("AppDatabase", () => {
  it("persists settings, jobs, pages, and manifests", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mangadl-db-"));
    const db = await AppDatabase.open(path.join(dir, "state.sqlite"));
    const settings = db.updateSettings({ activePages: 7, language: "th" });
    expect(settings.activePages).toBe(7);
    expect(settings.language).toBe("th");

    db.upsertJob({
      id: "job-1",
      sourceId: "mock",
      mangaId: "manga-1",
      mangaTitle: "Mock Manga",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
      chapterLabel: "c1",
      status: "queued",
      progressDone: 0,
      progressTotal: 1,
      retryCount: 0,
      outputDir: dir,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      payload: {
        manga: { sourceId: "mock", mangaId: "manga-1", title: "Mock Manga" },
        chapter: { sourceId: "mock", mangaId: "manga-1", chapterId: "chapter-1" }
      }
    });
    db.upsertPage({
      jobId: "job-1",
      pageIndex: 0,
      url: "https://mock.test/1.jpg",
      status: "pending",
      attempts: 0,
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    db.saveManifest({
      id: "mock",
      displayName: "Mock",
      baseUrl: "https://mock.test",
      hostnames: ["mock.test"],
      enabled: true,
      confidence: 1
    });

    expect(db.listJobs()).toHaveLength(1);
    expect(db.listPages("job-1")).toHaveLength(1);
    expect(db.listManifests()[0]?.id).toBe("mock");
    db.close();
  });
});
