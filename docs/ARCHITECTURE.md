# MangaDL Architecture

This document describes MangaDL's current architecture, the source/plugin model, downloader resilience strategy, persistence model, and the intended path for adding more sources.

## Goals

- Provide a desktop GUI for browsing, reading, and downloading manga/manhwa.
- Make bulk downloads resilient: bounded parallelism, retry, pause/resume, crash recovery, and file reconciliation.
- Keep source integration extensible: native APIs where available, declarative manifests for site families, adaptive manifests for newly probed sites.
- Keep risky capabilities out of the renderer. Filesystem, SQLite, source sessions, and downloads live in Electron main.
- Avoid bypassing DRM, CAPTCHA, paywalls, or technical access controls.

## Non-Goals

- Guarantee every volatile public manga site will always work.
- Circumvent access controls.
- Store downloaded content outside the user's configured library root without explicit configuration.
- Implement a browser extension; this is a desktop app with controlled Electron windows.

## High-Level System

```text
React Renderer
  Search / Detail / Downloads / Library / Sources / Settings
          |
          | typed preload bridge
          v
Electron Preload
          |
          | IPC channels from @mangadl/core
          v
Electron Main
  SourceRegistry
  DownloadManager
  AppDatabase
  per-source Electron sessions
  auth/sign-in windows
          |
          +--> Source adapters/manifests
          +--> SQLite userData database
          +--> OneDrive manga library
```

## Packages

### `packages/core`

Shared contracts and constants:

- `SourceAdapter`, `SourceContext`, source capabilities and health.
- Manga, chapter, page, and download models.
- Browse/search query/result models.
- Download settings and defaults.
- IPC channel names.
- Filesystem helper functions such as folder sanitization.

This package is intentionally dependency-light because every other package imports it.

### `packages/sources`

Source discovery and crawling:

- `MangaDexAdapter`: native adapter for MangaDex public API and at-home image resolution.
- `ManifestSourceAdapter`: declarative HTML source implementation.
- `presetManifests`: source presets for site families and known public sources.
- `AdaptiveManifestBuilder`: first pass at generating a manifest by probing a source URL.
- `SourceRegistry`: owns adapter registration, search, browse, detail lookup, health checks, and adaptive registration.

The registry accepts either a single `SourceContext` or a source-specific context factory. Electron main uses the factory form so each source gets the right persistent session and cookies.

### `packages/downloader`

Download execution and library handling:

- `DownloadManager`: job queue, status transitions, page downloads, pause/resume/cancel/retry.
- `Semaphore`: bounded concurrency for global chapter/page work and per-host request limits.
- `retry`: exponential backoff and jitter helpers.
- `cbz`: CBZ generation.
- `library`: downloaded folder scanner.
- `store`: persistence interface consumed by the manager.

### `packages/persistence`

SQLite storage using Node's built-in SQLite support:

- Settings.
- Saved source manifests.
- Download jobs.
- Download page records.

The database is opened under Electron `userData`.

### `apps/desktop`

Desktop shell:

- Electron main process: app lifecycle, IPC handlers, source sessions, download manager, SQLite, auth windows.
- Electron preload: exposes a small `window.mangadl` API.
- React renderer: GUI views and user interactions.
- Vite: renderer dev/build pipeline.

## Runtime Data Flow

### Browse/Search

```text
Renderer SearchView
  -> window.mangadl.manga.browse/search(...)
  -> preload ipcRenderer.invoke(...)
  -> Electron main ipcMain.handle(...)
  -> SourceRegistry.browse/search(...)
  -> SourceAdapter using SourceContext.fetch(...)
  -> Renderer receives summaries
```

When the search box is empty, the renderer calls `browse`. When it contains text, it calls `search`.

Browse is intentionally separate from search because many sources have homepage/category/listing pages rather than a searchable paginated API.

### Manga Details

```text
Renderer selects MangaSummary
  -> manga:get
  -> registry.getManga(...)
  -> adapter.getManga(...)
  -> adapter.listChapters(...)
  -> Renderer receives details + chapters
```

### Chapter Preview

```text
Renderer clicks Preview
  -> chapter:preview
  -> adapter.resolveChapter(...)
  -> ChapterAssetPlan with page URLs
  -> Renderer displays first pages
```

### Download

```text
Renderer queues chapters
  -> downloads:add
  -> DownloadManager.add(...)
  -> SQLite job records
  -> DownloadManager workers
      -> adapter.resolveChapter(...)
      -> download page assets with bounded concurrency
      -> write numbered image files
      -> write metadata/state
      -> generate chapter.cbz
      -> update SQLite page/job status
  -> snapshot events back to renderer
```

## Source Architecture

### Adapter Contract

The `SourceAdapter` interface is the stable extension point:

```ts
type SourceAdapter = {
  id: string;
  displayName: string;
  baseUrl?: string;
  capabilities: SourceCapability[];
  match(inputUrl: string): boolean;
  browse(query: MangaBrowseQuery, ctx: SourceContext): Promise<MangaBrowseResult>;
  search(query: MangaSearchQuery, ctx: SourceContext): Promise<MangaSummary[]>;
  getManga(ref: MangaRef, ctx: SourceContext): Promise<MangaDetails>;
  listChapters(ref: MangaRef, ctx: SourceContext): Promise<ChapterRef[]>;
  resolveChapter(ref: ChapterRef, ctx: SourceContext): Promise<ChapterAssetPlan>;
  authenticate?: (ctx: SourceContext) => Promise<AuthStatus>;
  health?: (ctx: SourceContext) => Promise<SourceHealth>;
};
```

### Native API Adapters

Use a native adapter when a source has a stable public API or requires custom request flows. MangaDex is the current example:

- Browse/search with `/manga`.
- Details with `/manga/{id}`.
- Chapters with `/manga/{id}/feed`.
- Pages with `/at-home/server/{chapterId}`.

### Manifest Adapters

Use manifests when a source can be described as HTML selectors and URL templates:

- `browse.pathTemplate`: site listing page or paginated category.
- `browse.sortTemplates`: optional sort/period templates.
- `search.pathTemplate`: search URL.
- `manga`: title, cover, description selectors.
- `chapters`: chapter row selectors.
- `pages`: reader image selectors and source attributes.

Manifest adapters are deliberately best-effort. They are allowed to return notices or fail without bringing down the whole multi-source browse request.

### Adaptive Manifests

The adaptive system probes a user-provided URL and attempts to create a manifest from observable page structure. The intended confidence ladder is:

1. Official/API patterns.
2. Embedded JSON app state, including common framework data blobs.
3. Static HTML selectors.
4. XHR/network-observed endpoints.
5. Rendered DOM/image discovery.

Generated manifests should validate enough of the flow before being enabled: manga details, chapter list, and page image URLs. Low-confidence results should appear as review-needed sources.

## Browse Semantics

The GUI supports:

- Latest.
- Favorites.
- Rating.
- Views with week/month/year/all period.
- Site default.
- Page navigation.

Not every source exposes these dimensions. The adapter should choose the closest responsible behavior and report notices when it falls back. Examples:

- MangaDex does not expose view counts by period through the public manga list API, so views use followed count.
- Some manifest sites only have homepage/page listings; sort controls fall back to their normal paginated listing.
- Some sites reject scripted requests; those failures are surfaced as notices and do not stop other sources.

## Downloader Resilience

### Concurrency

Default settings:

- Active chapters: 4.
- Active page downloads: 12.
- Requests per host: 3.

The downloader uses semaphores so work is bounded globally and by host.

### Retry

The retry policy uses exponential backoff with jitter. Transient failures are retried up to the configured attempt count. HTTP 429 and 503 are treated as source pressure signals and can trigger cooldown behavior.

### Pause and Resume

Pause stops new work and allows in-flight writes to settle. Resume reloads queue state, checks existing page records, and continues incomplete jobs.

### Crash Recovery

Download jobs and page records are persisted in SQLite. On startup, the manager can restore incomplete work. Already-completed pages are skipped where possible, and incomplete CBZ files can be regenerated.

### File Safety

Valid existing files are not overwritten by default. Mismatches should be repaired through explicit retry/repair actions rather than silent replacement.

## Persistence

SQLite database:

```text
Electron userData/
  mangadl.sqlite
```

Downloaded library:

```text
C:\Users\gunka\OneDrive\manga\
  <Manga Title>\
    <Chapter Label>\
      0001.jpg
      chapter.cbz
      chapter.json
      .mangadl-state.json
```

The split keeps application state local to Electron and content in the user's OneDrive-synced folder.

## IPC Boundary

The renderer does not import Electron directly. It uses the preload bridge:

```text
window.mangadl.settings.*
window.mangadl.sources.*
window.mangadl.manga.*
window.mangadl.downloads.*
window.mangadl.library.*
```

Electron main owns:

- File reads/writes.
- SQLite.
- Source sessions and cookies.
- Auth windows.
- Downloader queue lifecycle.
- Shell open-path operations.

## Source Sessions and Auth

Each source gets a persistent Electron session partition:

```text
persist:mangadl-source-<sourceId>
```

Sign-in opens a regular Electron window using that partition. Later source requests use the same partition, allowing cookies/session state to be reused. This supports user-owned access without embedding credentials in app code.

## Adding a New Native Source

1. Add a new adapter in `packages/sources/src`.
2. Implement `SourceAdapter`.
3. Include accurate `capabilities`.
4. Use `SourceContext.fetch` for all network access.
5. Return stable `MangaSummary`, `ChapterRef`, and `ChapterAssetPlan` records.
6. Register the adapter in `SourceRegistry`.
7. Add tests for search/browse/detail/chapter/page behavior.

## Adding a New Manifest Source

1. Add a manifest to `presetManifests` or save one through adaptive probing.
2. Provide `hostnames` and `baseUrl`.
3. Add `browse` rules for default catalog pages.
4. Add `sortTemplates` where the source has explicit sorted URLs.
5. Add `search`, `manga`, `chapters`, and `pages` selectors.
6. Mark `needsReview` when confidence is low.
7. Test against fixtures or a mock site before relying on the live source.

## Testing Strategy

Current tests cover:

- Folder sanitization.
- Manifest parsing.
- Retry/backoff behavior.
- CBZ generation.
- SQLite persistence.

Recommended future tests:

- Mock source browse feeds with pagination and sort fallbacks.
- Interrupted downloads and resume reconciliation.
- Broken image URLs and asset re-resolution.
- 429/503 cooldown behavior.
- Electron UI flows for browse, bulk queueing, pause/resume, library repair, and sign-in placeholders.

## Known Risks

- Public manga sites often change markup, domains, routing, and bot policies.
- Some source preset URLs/selectors may need review.
- Node SQLite is currently experimental in Node 24.
- OneDrive sync can temporarily lock or delay files during large bulk downloads.
- Electron source sessions should be treated as sensitive local user data.

## Operational Commands

```powershell
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
npm run clean
```
