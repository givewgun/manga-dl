# MangaDL

MangaDL is a TypeScript/Electron desktop app for browsing, reading, and downloading manga/manhwa from multiple sources. It is designed around resilient bulk downloads and a pluggable source system so new sites can be added with native adapters, declarative manifests, or generated adaptive manifests.

The default download location is:

```text
C:\Users\gunka\OneDrive\manga
```

Each manga is saved in its own folder, each chapter is saved in its own subfolder, and completed chapters can include both numbered image files and `chapter.cbz`.

## Status

This is an early greenfield implementation. The main app shell, source contracts, MangaDex native adapter, manifest-based sources, adaptive probing foundation, SQLite persistence, library scanning, CBZ generation, and resilient downloader queue are implemented. Some preset sources are marked as review/adaptive because public manga sites change often and may block scripted access, require sign-in, or expose incomplete metadata.

MangaDL does not bypass DRM, CAPTCHA, paywalls, or technical access controls. For sources that require access, use the app sign-in window with your own account/session.

## Features

- Desktop GUI built with Electron, React, and Vite.
- Search, browse, source, downloads, library, and settings views.
- Default catalog browsing when the search field is empty.
- Browse sorting controls for latest, favorites, rating, views, and site default.
- Browse period controls for view-based feeds: week, month, year, all.
- MangaDex native API support, including cover art and at-home chapter image resolution.
- Manifest-based source presets for several common manga/manhwa site families.
- Source sign-in windows with persistent per-source Electron sessions.
- Bulk chapter queueing across manga and sources.
- Pause/resume/cancel/retry controls.
- Global and host-level concurrency controls.
- Retry with exponential backoff and jitter.
- Per-source cooldown behavior for rate-limit/service-unavailable responses.
- Crash recovery through persisted download jobs and page records.
- Library scanner for downloaded folders.
- CBZ generation and regeneration.
- Configurable download root, language, concurrency, retry attempts, and CBZ output.

## Requirements

- Node.js `>=24.0.0`
- npm
- Git
- Windows is the current primary target because the default path points at OneDrive on Windows.

The project was created and tested with Node `24.14.1`.

## Quick Start

Install dependencies:

```powershell
npm install
```

Run the desktop app in development mode:

```powershell
npm run dev
```

The development command builds the shared packages, starts Vite, then launches Electron. Use the Electron window for the app. Opening the Vite URL in a normal browser cannot access the Electron preload bridge, filesystem operations, SQLite database, or source sessions.

Run checks:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

Clean build artifacts:

```powershell
npm run clean
```

## Workspace Layout

```text
apps/
  desktop/          Electron main/preload plus React renderer
packages/
  core/             Shared contracts, IPC names, defaults, filesystem helpers
  sources/          Source registry, MangaDex adapter, manifest adapter, presets, adaptive probing
  downloader/       Queue manager, retry logic, semaphores, library scan, CBZ generation
  persistence/      SQLite-backed settings, manifests, jobs, page records
scripts/
  run-electron.mjs  Electron launcher that avoids ELECTRON_RUN_AS_NODE leakage
  clean.mjs         Build artifact cleanup
docs/
  ARCHITECTURE.md   System architecture and data flow
  adr/              Architecture decision records
```

## Download Output

By default, a downloaded chapter is stored like this:

```text
C:\Users\gunka\OneDrive\manga\
  <Manga Title>\
    <Chapter Label>\
      0001.jpg
      0002.jpg
      chapter.cbz
      chapter.json
      .mangadl-state.json
```

Existing valid files are skipped. Repairing mismatched or failed files is intended to happen through explicit retry/repair actions rather than silent overwrite.

## Source Model

MangaDL supports sources through a stable adapter contract:

```ts
type SourceAdapter = {
  id: string;
  displayName: string;
  capabilities: SourceCapability[];
  match(inputUrl: string): boolean;
  browse(query: MangaBrowseQuery, ctx: SourceContext): Promise<MangaBrowseResult>;
  search(query: MangaSearchQuery, ctx: SourceContext): Promise<MangaSummary[]>;
  getManga(ref: MangaRef, ctx: SourceContext): Promise<MangaDetails>;
  listChapters(ref: MangaRef, ctx: SourceContext): Promise<ChapterRef[]>;
  resolveChapter(ref: ChapterRef, ctx: SourceContext): Promise<ChapterAssetPlan>;
  authenticate?: (ctx: SourceContext) => Promise<AuthStatus>;
};
```

Source tiers:

- Native adapters for stable public APIs, currently MangaDex.
- Declarative manifests for HTML-based public sites.
- Adaptive/generated manifests from a source URL probe, saved for later use.

See [Architecture](docs/ARCHITECTURE.md) for the source lifecycle and extension guide.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [ADR Index](docs/adr/README.md)
- [ADR 0001: TypeScript, Electron, React, and Vite](docs/adr/0001-typescript-electron-react-vite.md)
- [ADR 0002: Source Adapter and Manifest Architecture](docs/adr/0002-source-adapter-and-manifest-architecture.md)
- [ADR 0003: Resilient Downloader Queue](docs/adr/0003-resilient-downloader-queue.md)
- [ADR 0004: Electron IPC and Source Sessions](docs/adr/0004-electron-ipc-and-source-sessions.md)
- [ADR 0005: Local Persistence and OneDrive Library Layout](docs/adr/0005-local-persistence-and-onedrive-library-layout.md)

## Development Notes

- Renderer code talks to Electron through the typed preload bridge only.
- Main process owns filesystem access, SQLite, source sessions, auth windows, and downloader control.
- Source fetches run through per-source Electron sessions so cookies and sign-in state can be reused.
- Download workers resolve image URLs through the source adapter and can re-resolve chapter assets when URLs expire.
- Build outputs, logs, SQLite files, `node_modules`, and TypeScript build info are ignored.

## Responsible Use

Only use MangaDL with sources and content you are allowed to access. Respect source terms, rate limits, robots/access policies, and copyright law. The app is intentionally not designed to defeat DRM, CAPTCHAs, paywalls, or other access controls.
