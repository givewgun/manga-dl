import type {
  DownloadJob,
  DownloadPageRecord,
  DownloadSettings,
  SourceManifest
} from "@mangadl/core";

export interface DownloadStore {
  getSettings(): DownloadSettings;
  updateSettings(settings: Partial<DownloadSettings>): DownloadSettings;
  upsertJob(job: DownloadJob): void;
  getJob(id: string): DownloadJob | undefined;
  listJobs(): DownloadJob[];
  upsertPage(page: DownloadPageRecord): void;
  listPages(jobId: string): DownloadPageRecord[];
  saveManifest(manifest: SourceManifest): void;
  listManifests(): SourceManifest[];
}
