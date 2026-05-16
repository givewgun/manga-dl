import { createRequire } from "node:module";
import {
  IPC,
  type DownloadChapterRequest,
  type DownloadSettings,
  type MangaBrowseQuery,
  type MangaRef,
  type MangaSearchQuery
} from "@mangadl/core";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const api = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch: Partial<DownloadSettings>) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  sources: {
    list: () => ipcRenderer.invoke(IPC.sourcesList),
    health: () => ipcRenderer.invoke(IPC.sourcesHealth),
    signIn: (sourceId: string) => ipcRenderer.invoke(IPC.sourcesSignin, sourceId),
    probe: (url: string) => ipcRenderer.invoke(IPC.sourcesProbe, url)
  },
  manga: {
    browse: (query: MangaBrowseQuery) => ipcRenderer.invoke(IPC.browse, query),
    search: (query: MangaSearchQuery) => ipcRenderer.invoke(IPC.search, query),
    get: (ref: MangaRef) => ipcRenderer.invoke(IPC.mangaGet, ref),
    chapters: (ref: MangaRef) => ipcRenderer.invoke(IPC.chaptersList, ref),
    preview: (chapter: unknown) => ipcRenderer.invoke(IPC.chapterPreview, chapter)
  },
  downloads: {
    add: (requests: DownloadChapterRequest[]) => ipcRenderer.invoke(IPC.downloadsAdd, requests),
    list: () => ipcRenderer.invoke(IPC.downloadsList),
    pause: () => ipcRenderer.invoke(IPC.downloadsPause),
    resume: () => ipcRenderer.invoke(IPC.downloadsResume),
    cancel: (jobId: string) => ipcRenderer.invoke(IPC.downloadsCancel, jobId),
    retry: (jobId: string) => ipcRenderer.invoke(IPC.downloadsRetry, jobId),
    onSnapshot: (callback: (snapshot: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown) => callback(snapshot);
      ipcRenderer.on(IPC.downloadsEvent, listener);
      return () => ipcRenderer.removeListener(IPC.downloadsEvent, listener);
    }
  },
  library: {
    scan: () => ipcRenderer.invoke(IPC.libraryScan),
    regenerateCbz: (chapterDir: string, pages: string[]) =>
      ipcRenderer.invoke(IPC.libraryRegenerateCbz, chapterDir, pages),
    openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath)
  }
};

contextBridge.exposeInMainWorld("mangadl", api);

export type MangaDlApi = typeof api;
