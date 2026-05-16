import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  APP_USER_AGENT,
  DEFAULT_SETTINGS,
  IPC,
  type ChapterRef,
  type DownloadChapterRequest,
  type DownloadSettings,
  type MangaBrowseQuery,
  type MangaRef,
  type MangaSearchQuery
} from "@mangadl/core";
import { createCbz, DownloadManager, scanLibrary } from "@mangadl/downloader";
import { AppDatabase } from "@mangadl/persistence";
import { SourceRegistry } from "@mangadl/sources";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { app, BrowserWindow, ipcMain, session, shell } = require("electron") as typeof import("electron");

let mainWindow: Electron.BrowserWindow | undefined;
let db: AppDatabase;
let registry: SourceRegistry;
let downloads: DownloadManager;

function sourcePartition(sourceId: string): string {
  return `persist:mangadl-source-${sourceId}`;
}

function sourceSession(sourceId: string) {
  return session.fromPartition(sourcePartition(sourceId));
}

function sourceContext(sourceId: string, signal?: AbortSignal) {
  const ses = sourceSession(sourceId);
  return {
    userAgent: APP_USER_AGENT,
    language: db.getSettings().language,
    signal,
    fetch: async (input: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("user-agent")) headers.set("user-agent", APP_USER_AGENT);
      const controller = init?.signal || signal ? undefined : new AbortController();
      const timeout = controller ? setTimeout(() => controller.abort(), 15_000) : undefined;
      try {
        return await ses.fetch(String(input), {
          ...init,
          headers,
          signal: init?.signal ?? signal ?? controller?.signal
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
  };
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  db = await AppDatabase.open(path.join(app.getPath("userData"), "mangadl.sqlite"));
  db.updateSettings({ ...DEFAULT_SETTINGS, ...db.getSettings() });
  registry = new SourceRegistry(db.listManifests());
  downloads = new DownloadManager({
    store: db,
    resolveChapter: async (chapter: ChapterRef, signal: AbortSignal) =>
      registry.get(chapter.sourceId).resolveChapter(chapter, sourceContext(chapter.sourceId, signal)),
    fetchForSource: async (sourceId, input, init) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("user-agent")) headers.set("user-agent", APP_USER_AGENT);
      return sourceSession(sourceId).fetch(input, { ...init, headers });
    }
  });
  downloads.on("snapshot", (snapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.downloadsEvent, snapshot);
    }
  });
  downloads.start();

  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#f7f8fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist-renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.settingsGet, () => db.getSettings());
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<DownloadSettings>) =>
    downloads.updateSettings(patch)
  );

  ipcMain.handle(IPC.sourcesList, () => registry.list());
  ipcMain.handle(IPC.sourcesHealth, async () => registry.health((sourceId) => sourceContext(sourceId)));
  ipcMain.handle(IPC.sourcesSignin, async (_event, sourceId: string) => signIn(sourceId));
  ipcMain.handle(IPC.sourcesProbe, async (_event, url: string) => {
    const result = await registry.probe(url, sourceContext("adaptive-probe"));
    db.saveManifest(result.manifest);
    return result;
  });

  ipcMain.handle(IPC.browse, async (_event, query: MangaBrowseQuery) =>
    registry.browse(query, sourceContext)
  );
  ipcMain.handle(IPC.search, async (_event, query: MangaSearchQuery) =>
    registry.search(query, sourceContext)
  );
  ipcMain.handle(IPC.mangaGet, async (_event, ref: MangaRef) =>
    registry.getManga(ref, sourceContext(ref.sourceId))
  );
  ipcMain.handle(IPC.chaptersList, async (_event, ref: MangaRef) =>
    registry.get(ref.sourceId).listChapters(ref, sourceContext(ref.sourceId))
  );
  ipcMain.handle(IPC.chapterPreview, async (_event, chapter: ChapterRef) =>
    registry.get(chapter.sourceId).resolveChapter(chapter, sourceContext(chapter.sourceId))
  );

  ipcMain.handle(IPC.downloadsAdd, async (_event, requests: DownloadChapterRequest[]) =>
    downloads.add(requests)
  );
  ipcMain.handle(IPC.downloadsList, () => downloads.listJobs());
  ipcMain.handle(IPC.downloadsPause, () => downloads.pause());
  ipcMain.handle(IPC.downloadsResume, () => downloads.resume());
  ipcMain.handle(IPC.downloadsCancel, (_event, jobId: string) => downloads.cancel(jobId));
  ipcMain.handle(IPC.downloadsRetry, (_event, jobId: string) => downloads.retry(jobId));

  ipcMain.handle(IPC.libraryScan, async () => scanLibrary(db.getSettings().downloadRoot));
  ipcMain.handle(IPC.libraryRegenerateCbz, async (_event, chapterDir: string, pages: string[]) => {
    await createCbz(chapterDir, pages, path.join(chapterDir, "chapter.cbz"));
    return true;
  });
  ipcMain.handle("shell:open-path", async (_event, targetPath: string) => shell.openPath(targetPath));
}

async function signIn(sourceId: string): Promise<{ sourceId: string; signedIn: boolean; message: string }> {
  const adapter = registry.get(sourceId);
  const url = adapter.baseUrl ?? "https://mangadex.org";

  await new Promise<void>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 1060,
      height: 760,
      parent: mainWindow,
      modal: false,
      title: `Sign in to ${adapter.displayName}`,
      webPreferences: {
        partition: sourcePartition(sourceId),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    win.on("closed", resolve);
    win.webContents.on("did-fail-load", (_event, _code, description) => reject(new Error(description)));
    void win.loadURL(url);
  });

  return {
    sourceId,
    signedIn: true,
    message: `Saved browser session for ${adapter.displayName}.`
  };
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  db?.close();
});

void bootstrap().catch((error) => {
  console.error(error);
  app.quit();
});
