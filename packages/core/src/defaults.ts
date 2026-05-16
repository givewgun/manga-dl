import type { DownloadSettings } from "./types.js";

export const APP_USER_AGENT =
  "MangaDL/0.1 (+local desktop downloader; respects source access controls)";

export const DEFAULT_DOWNLOAD_ROOT = "C:\\Users\\gunka\\OneDrive\\manga";

export const DEFAULT_SETTINGS: DownloadSettings = {
  downloadRoot: DEFAULT_DOWNLOAD_ROOT,
  activeChapters: 4,
  activePages: 12,
  requestsPerHost: 3,
  retryAttempts: 5,
  retryBaseDelayMs: 750,
  language: "en",
  writeCbz: true,
  overwriteExisting: false
};
