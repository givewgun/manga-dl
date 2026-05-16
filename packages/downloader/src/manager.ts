import { EventEmitter } from "node:events";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  chapterLabel,
  inferExtensionFromUrl,
  numberedPageFilename,
  sanitizePathSegment,
  type ChapterAssetPlan,
  type ChapterRef,
  type DownloadChapterRequest,
  type DownloadJob,
  type DownloadPageRecord,
  type DownloadSettings,
  type MangaRef
} from "@mangadl/core";
import { createCbz } from "./cbz.js";
import { RetryableDownloadError, backoffDelayMs, sleep } from "./retry.js";
import { Semaphore } from "./semaphore.js";
import type { DownloadStore } from "./store.js";

export type ChapterResolver = (chapter: ChapterRef, signal: AbortSignal) => Promise<ChapterAssetPlan>;
export type SourceFetcher = (
  sourceId: string,
  input: string,
  init: RequestInit | undefined
) => Promise<Response>;

export interface DownloadManagerOptions {
  store: DownloadStore;
  resolveChapter: ChapterResolver;
  fetchForSource: SourceFetcher;
}

export class DownloadManager extends EventEmitter {
  private settings: DownloadSettings;
  private paused = false;
  private readonly activeJobs = new Map<string, AbortController>();
  private pageSemaphore: Semaphore;
  private readonly hostSemaphores = new Map<string, Semaphore>();
  private readonly hostCooldowns = new Map<string, number>();

  constructor(private readonly options: DownloadManagerOptions) {
    super();
    this.settings = options.store.getSettings();
    this.pageSemaphore = new Semaphore(this.settings.activePages);
  }

  start(): void {
    for (const job of this.options.store.listJobs()) {
      if (job.status === "running") {
        this.options.store.upsertJob({ ...job, status: "queued", updatedAt: now() });
      }
    }
    this.schedule();
  }

  listJobs(): DownloadJob[] {
    return this.options.store.listJobs();
  }

  updateSettings(settings: Partial<DownloadSettings>): DownloadSettings {
    this.settings = this.options.store.updateSettings(settings);
    this.pageSemaphore = new Semaphore(this.settings.activePages);
    this.hostSemaphores.clear();
    this.emitSnapshot();
    this.schedule();
    return this.settings;
  }

  async add(requests: DownloadChapterRequest[]): Promise<DownloadJob[]> {
    const created: DownloadJob[] = [];
    for (const request of requests) {
      const id = jobId(request.manga, request.chapter);
      const existing = this.options.store.getJob(id);
      if (existing && existing.status !== "cancelled") {
        created.push(existing);
        continue;
      }

      const mangaTitle = request.manga.title ?? request.chapter.mangaTitle ?? request.manga.mangaId;
      const label = chapterLabel(request.chapter);
      const outputDir = path.join(
        this.settings.downloadRoot,
        sanitizePathSegment(mangaTitle, "manga"),
        label
      );
      const timestamp = now();
      const job: DownloadJob = {
        id,
        sourceId: request.chapter.sourceId,
        mangaId: request.manga.mangaId,
        mangaTitle,
        chapterId: request.chapter.chapterId,
        chapterTitle: request.chapter.title ?? label,
        chapterLabel: label,
        status: "queued",
        progressDone: 0,
        progressTotal: 0,
        retryCount: 0,
        outputDir,
        createdAt: timestamp,
        updatedAt: timestamp,
        payload: request
      };
      this.options.store.upsertJob(job);
      created.push(job);
    }

    this.emitSnapshot();
    this.schedule();
    return created;
  }

  pause(): void {
    this.paused = true;
    for (const job of this.options.store.listJobs()) {
      if (job.status === "queued") {
        this.options.store.upsertJob({ ...job, status: "paused", updatedAt: now() });
      }
    }
    this.emitSnapshot();
  }

  resume(): void {
    this.paused = false;
    for (const job of this.options.store.listJobs()) {
      if (job.status === "paused") {
        this.options.store.upsertJob({ ...job, status: "queued", updatedAt: now() });
      }
    }
    this.emitSnapshot();
    this.schedule();
  }

  cancel(jobIdToCancel: string): void {
    this.activeJobs.get(jobIdToCancel)?.abort();
    const job = this.options.store.getJob(jobIdToCancel);
    if (job) {
      this.options.store.upsertJob({
        ...job,
        status: "cancelled",
        updatedAt: now()
      });
    }
    this.emitSnapshot();
  }

  retry(jobIdToRetry: string): void {
    const job = this.options.store.getJob(jobIdToRetry);
    if (!job) return;
    this.options.store.upsertJob({
      ...job,
      status: "queued",
      error: undefined,
      updatedAt: now()
    });
    for (const page of this.options.store.listPages(jobIdToRetry)) {
      if (page.status === "failed") {
        this.options.store.upsertPage({ ...page, status: "pending", error: undefined, updatedAt: now() });
      }
    }
    this.emitSnapshot();
    this.schedule();
  }

  private schedule(): void {
    if (this.paused) return;
    const available = this.settings.activeChapters - this.activeJobs.size;
    if (available <= 0) return;

    const jobs = this.options.store
      .listJobs()
      .filter((job) => job.status === "queued")
      .slice(0, available);

    for (const job of jobs) {
      const controller = new AbortController();
      this.activeJobs.set(job.id, controller);
      void this.runJob(job, controller).finally(() => {
        this.activeJobs.delete(job.id);
        this.emitSnapshot();
        this.schedule();
      });
    }
  }

  private async runJob(initialJob: DownloadJob, controller: AbortController): Promise<void> {
    let job: DownloadJob = { ...initialJob, status: "running", updatedAt: now() };
    this.options.store.upsertJob(job);
    this.emitSnapshot();

    try {
      await mkdir(job.outputDir, { recursive: true });
      const plan = await this.options.resolveChapter(job.payload.chapter, controller.signal);
      await this.writeMetadata(job, plan);
      this.ensurePageRecords(job, plan);
      await this.downloadPages(job, plan, controller.signal);

      const pages = this.options.store.listPages(job.id);
      const failed = pages.filter((page) => page.status === "failed");
      if (failed.length > 0) {
        throw new Error(`${failed.length} page(s) failed`);
      }

      const completedFiles = pages
        .filter((page) => page.filePath && (page.status === "completed" || page.status === "skipped"))
        .map((page) => page.filePath as string)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (this.settings.writeCbz) {
        await createCbz(job.outputDir, completedFiles, path.join(job.outputDir, "chapter.cbz"));
      }

      job = {
        ...this.options.store.getJob(job.id)!,
        status: "completed",
        progressDone: completedFiles.length,
        progressTotal: pages.length,
        error: undefined,
        updatedAt: now()
      };
      this.options.store.upsertJob(job);
    } catch (error) {
      const current = this.options.store.getJob(job.id) ?? job;
      if (current.status === "cancelled" || controller.signal.aborted) {
        this.options.store.upsertJob({ ...current, status: "cancelled", updatedAt: now() });
        return;
      }
      this.options.store.upsertJob({
        ...current,
        status: this.paused ? "paused" : "failed",
        error: error instanceof Error ? error.message : String(error),
        updatedAt: now()
      });
    }
  }

  private ensurePageRecords(job: DownloadJob, plan: ChapterAssetPlan): void {
    const existing = new Map(this.options.store.listPages(job.id).map((page) => [page.pageIndex, page]));
    for (const page of plan.pages) {
      if (existing.has(page.index)) continue;
      this.options.store.upsertPage({
        jobId: job.id,
        pageIndex: page.index,
        url: page.url,
        status: "pending",
        attempts: 0,
        updatedAt: now()
      });
    }
    const current = this.options.store.getJob(job.id) ?? job;
    this.options.store.upsertJob({
      ...current,
      progressTotal: plan.pages.length,
      progressDone: this.options.store
        .listPages(job.id)
        .filter((page) => page.status === "completed" || page.status === "skipped").length,
      updatedAt: now()
    });
  }

  private async downloadPages(job: DownloadJob, plan: ChapterAssetPlan, signal: AbortSignal): Promise<void> {
    const pending = this.options.store
      .listPages(job.id)
      .filter((page) => page.status === "pending" || page.status === "failed")
      .sort((a, b) => a.pageIndex - b.pageIndex);

    let cursor = 0;
    const workers = Array.from({ length: Math.min(this.settings.activePages, pending.length) }, async () => {
      while (!this.paused && !signal.aborted) {
        const record = pending[cursor];
        cursor += 1;
        if (!record) return;
        const page = plan.pages.find((candidate) => candidate.index === record.pageIndex);
        if (!page) continue;
        await this.downloadPage(job, plan, record, page.url, signal);
        this.updateJobProgress(job.id);
      }
    });

    await Promise.all(workers);

    if (this.paused) {
      const current = this.options.store.getJob(job.id) ?? job;
      this.options.store.upsertJob({ ...current, status: "paused", updatedAt: now() });
    }
  }

  private async downloadPage(
    job: DownloadJob,
    plan: ChapterAssetPlan,
    record: DownloadPageRecord,
    pageUrl: string,
    signal: AbortSignal
  ): Promise<void> {
    const releasePage = await this.pageSemaphore.acquire();
    const releaseHost = await this.hostSemaphore(pageUrl).acquire();
    try {
      const extension = inferExtensionFromUrl(pageUrl);
      const filename = numberedPageFilename(record.pageIndex, extension);
      const filePath = path.join(job.outputDir, filename);

      if (!this.settings.overwriteExisting && (await existsWithContent(filePath))) {
        this.options.store.upsertPage({
          ...record,
          url: pageUrl,
          filePath,
          status: "skipped",
          updatedAt: now()
        });
        return;
      }

      this.options.store.upsertPage({
        ...record,
        status: "running",
        updatedAt: now()
      });

      for (let attempt = record.attempts + 1; attempt <= this.settings.retryAttempts; attempt += 1) {
        try {
          await this.waitForCooldown(pageUrl, signal);
          const headers = {
            ...(plan.headers ?? {}),
            ...(plan.referer ? { referer: plan.referer } : {})
          };
          const response = await this.options.fetchForSource(job.sourceId, pageUrl, {
            signal,
            headers
          });

          if (response.status === 429 || response.status === 503) {
            this.cooldownHost(pageUrl, attempt);
            throw new RetryableDownloadError(`Source throttled request (${response.status})`, response.status);
          }

          if (!response.ok) {
            throw new RetryableDownloadError(`Page request failed ${response.status}`, response.status);
          }

          const contentType = response.headers.get("content-type");
          const actualExtension = inferExtensionFromUrl(pageUrl, contentType);
          const actualPath = path.join(job.outputDir, numberedPageFilename(record.pageIndex, actualExtension));
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length === 0) throw new RetryableDownloadError("Downloaded page is empty");

          await writeAtomic(actualPath, bytes);
          this.options.store.upsertPage({
            ...record,
            url: pageUrl,
            filePath: actualPath,
            status: "completed",
            attempts: attempt,
            error: undefined,
            updatedAt: now()
          });
          return;
        } catch (error) {
          if (signal.aborted) throw error;
          const message = error instanceof Error ? error.message : String(error);
          this.options.store.upsertPage({
            ...record,
            url: pageUrl,
            status: "failed",
            attempts: attempt,
            error: message,
            updatedAt: now()
          });
          this.bumpJobRetry(job.id);
          if (attempt >= this.settings.retryAttempts) return;
          await sleep(backoffDelayMs(attempt, this.settings.retryBaseDelayMs), signal);
        }
      }
    } finally {
      releaseHost();
      releasePage();
    }
  }

  private updateJobProgress(id: string): void {
    const job = this.options.store.getJob(id);
    if (!job) return;
    const pages = this.options.store.listPages(id);
    this.options.store.upsertJob({
      ...job,
      progressDone: pages.filter((page) => page.status === "completed" || page.status === "skipped").length,
      progressTotal: pages.length,
      updatedAt: now()
    });
    this.emitSnapshot();
  }

  private bumpJobRetry(id: string): void {
    const job = this.options.store.getJob(id);
    if (!job) return;
    this.options.store.upsertJob({
      ...job,
      retryCount: job.retryCount + 1,
      updatedAt: now()
    });
  }

  private hostSemaphore(url: string): Semaphore {
    const host = hostFor(url);
    let semaphore = this.hostSemaphores.get(host);
    if (!semaphore) {
      semaphore = new Semaphore(this.settings.requestsPerHost);
      this.hostSemaphores.set(host, semaphore);
    }
    return semaphore;
  }

  private cooldownHost(url: string, attempt: number): void {
    const delay = Math.min(60_000, 5_000 * attempt);
    this.hostCooldowns.set(hostFor(url), Date.now() + delay);
  }

  private async waitForCooldown(url: string, signal: AbortSignal): Promise<void> {
    const until = this.hostCooldowns.get(hostFor(url)) ?? 0;
    await sleep(Math.max(0, until - Date.now()), signal);
  }

  private async writeMetadata(job: DownloadJob, plan: ChapterAssetPlan): Promise<void> {
    const metadata = {
      app: "MangaDL",
      version: 1,
      sourceId: job.sourceId,
      manga: plan.manga,
      chapter: plan.chapter,
      pageCount: plan.pages.length,
      savedAt: new Date().toISOString()
    };
    await writeAtomic(path.join(job.outputDir, "chapter.json"), Buffer.from(JSON.stringify(metadata, null, 2)));
    await writeAtomic(
      path.join(job.outputDir, ".mangadl-state.json"),
      Buffer.from(JSON.stringify({ jobId: job.id, status: job.status, updatedAt: now() }, null, 2))
    );
  }

  private emitSnapshot(): void {
    this.emit("snapshot", { jobs: this.options.store.listJobs() });
  }
}

function jobId(manga: MangaRef, chapter: ChapterRef): string {
  return createHash("sha1")
    .update(`${chapter.sourceId}|${manga.mangaId}|${chapter.chapterId}`)
    .digest("hex");
}

function now(): string {
  return new Date().toISOString();
}

function hostFor(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return randomUUID();
  }
}

async function existsWithContent(filePath: string): Promise<boolean> {
  try {
    const file = await stat(filePath);
    return file.isFile() && file.size > 0;
  } catch {
    return false;
  }
}

async function writeAtomic(filePath: string, bytes: Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.part`;
  await rm(tempPath, { force: true });
  await writeFile(tempPath, bytes);
  await rename(tempPath, filePath);
}
