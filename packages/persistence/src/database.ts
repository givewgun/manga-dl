import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_SETTINGS,
  type DownloadJob,
  type DownloadPageRecord,
  type DownloadSettings,
  type SourceManifest
} from "@mangadl/core";
import type { DownloadStore } from "@mangadl/downloader";

export class AppDatabase implements DownloadStore {
  private readonly db: DatabaseSync;

  private constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  static async open(dbPath: string): Promise<AppDatabase> {
    await mkdir(path.dirname(dbPath), { recursive: true });
    return new AppDatabase(dbPath);
  }

  close(): void {
    this.db.close();
  }

  getSettings(): DownloadSettings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const patch = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
    return { ...DEFAULT_SETTINGS, ...patch };
  }

  updateSettings(settings: Partial<DownloadSettings>): DownloadSettings {
    const insert = this.db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    this.db.exec("BEGIN");
    try {
      for (const [key, value] of Object.entries(settings)) {
        insert.run(key, JSON.stringify(value));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getSettings();
  }

  upsertJob(job: DownloadJob): void {
    this.db
      .prepare(
        `INSERT INTO downloads (
          id, source_id, manga_id, manga_title, chapter_id, chapter_title, chapter_label,
          status, progress_done, progress_total, retry_count, error, output_dir,
          created_at, updated_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_id = excluded.source_id,
          manga_id = excluded.manga_id,
          manga_title = excluded.manga_title,
          chapter_id = excluded.chapter_id,
          chapter_title = excluded.chapter_title,
          chapter_label = excluded.chapter_label,
          status = excluded.status,
          progress_done = excluded.progress_done,
          progress_total = excluded.progress_total,
          retry_count = excluded.retry_count,
          error = excluded.error,
          output_dir = excluded.output_dir,
          updated_at = excluded.updated_at,
          payload_json = excluded.payload_json`
      )
      .run(
        job.id,
        job.sourceId,
        job.mangaId,
        job.mangaTitle,
        job.chapterId,
        job.chapterTitle,
        job.chapterLabel,
        job.status,
        job.progressDone,
        job.progressTotal,
        job.retryCount,
        job.error ?? null,
        job.outputDir,
        job.createdAt,
        job.updatedAt,
        JSON.stringify(job.payload)
      );
  }

  getJob(id: string): DownloadJob | undefined {
    const row = this.db.prepare("SELECT * FROM downloads WHERE id = ?").get(id) as JobRow | undefined;
    return row ? rowToJob(row) : undefined;
  }

  listJobs(): DownloadJob[] {
    const rows = this.db
      .prepare("SELECT * FROM downloads ORDER BY created_at DESC")
      .all() as unknown as JobRow[];
    return rows.map(rowToJob);
  }

  upsertPage(page: DownloadPageRecord): void {
    this.db
      .prepare(
        `INSERT INTO download_pages (
          job_id, page_index, url, status, file_path, attempts, error, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id, page_index) DO UPDATE SET
          url = excluded.url,
          status = excluded.status,
          file_path = excluded.file_path,
          attempts = excluded.attempts,
          error = excluded.error,
          updated_at = excluded.updated_at`
      )
      .run(
        page.jobId,
        page.pageIndex,
        page.url,
        page.status,
        page.filePath ?? null,
        page.attempts,
        page.error ?? null,
        page.updatedAt
      );
  }

  listPages(jobId: string): DownloadPageRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM download_pages WHERE job_id = ? ORDER BY page_index ASC")
      .all(jobId) as unknown as PageRow[];
    return rows.map(rowToPage);
  }

  saveManifest(manifest: SourceManifest): void {
    const timestamp = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO source_manifests (id, json, enabled, confidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          json = excluded.json,
          enabled = excluded.enabled,
          confidence = excluded.confidence,
          updated_at = excluded.updated_at`
      )
      .run(
        manifest.id,
        JSON.stringify(manifest),
        manifest.enabled ? 1 : 0,
        manifest.confidence,
        timestamp,
        timestamp
      );
  }

  listManifests(): SourceManifest[] {
    const rows = this.db
      .prepare("SELECT json FROM source_manifests ORDER BY updated_at DESC")
      .all() as Array<{ json: string }>;
    return rows.map((row) => JSON.parse(row.json) as SourceManifest);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        manga_id TEXT NOT NULL,
        manga_title TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        chapter_title TEXT NOT NULL,
        chapter_label TEXT NOT NULL,
        status TEXT NOT NULL,
        progress_done INTEGER NOT NULL DEFAULT 0,
        progress_total INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        output_dir TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS download_pages (
        job_id TEXT NOT NULL,
        page_index INTEGER NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        file_path TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (job_id, page_index),
        FOREIGN KEY (job_id) REFERENCES downloads(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS source_manifests (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_pages_job_status ON download_pages(job_id, status);
    `);
  }
}

interface JobRow {
  id: string;
  source_id: string;
  manga_id: string;
  manga_title: string;
  chapter_id: string;
  chapter_title: string;
  chapter_label: string;
  status: DownloadJob["status"];
  progress_done: number;
  progress_total: number;
  retry_count: number;
  error: string | null;
  output_dir: string;
  created_at: string;
  updated_at: string;
  payload_json: string;
}

interface PageRow {
  job_id: string;
  page_index: number;
  url: string;
  status: DownloadPageRecord["status"];
  file_path: string | null;
  attempts: number;
  error: string | null;
  updated_at: string;
}

function rowToJob(row: JobRow): DownloadJob {
  return {
    id: row.id,
    sourceId: row.source_id,
    mangaId: row.manga_id,
    mangaTitle: row.manga_title,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
    chapterLabel: row.chapter_label,
    status: row.status,
    progressDone: row.progress_done,
    progressTotal: row.progress_total,
    retryCount: row.retry_count,
    error: row.error ?? undefined,
    outputDir: row.output_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: JSON.parse(row.payload_json) as DownloadJob["payload"]
  };
}

function rowToPage(row: PageRow): DownloadPageRecord {
  return {
    jobId: row.job_id,
    pageIndex: row.page_index,
    url: row.url,
    status: row.status,
    filePath: row.file_path ?? undefined,
    attempts: row.attempts,
    error: row.error ?? undefined,
    updatedAt: row.updated_at
  };
}
