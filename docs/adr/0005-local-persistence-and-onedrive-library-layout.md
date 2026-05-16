# ADR 0005: Local Persistence and OneDrive Library Layout

## Status

Accepted

## Context

The app needs durable application state and a user-visible downloaded library. The user specifically requested the OneDrive folder named `manga` so downloaded content auto-syncs.

Application state and content have different needs:

- App state should be compact, transactional, and local to the application.
- Downloaded content should be easy to browse, sync, back up, and open outside the app.

## Decision

Use SQLite under Electron `userData` for app state:

```text
<Electron userData>/mangadl.sqlite
```

Use OneDrive as the default library root:

```text
C:\Users\gunka\OneDrive\manga
```

Store chapters as:

```text
<Library Root>\
  <Manga Title>\
    <Chapter Label>\
      0001.jpg
      0002.jpg
      chapter.cbz
      chapter.json
      .mangadl-state.json
```

## Consequences

### Positive

- SQLite provides persistent queue state and settings.
- Downloaded content is human-readable and OneDrive-syncable.
- Folder structure is compatible with common image readers and CBZ readers.
- Per-chapter metadata can support repair, regeneration, and future import/export.

### Negative

- OneDrive may lock or delay files during sync.
- Windows path limits and invalid characters require folder sanitization.
- User-renamed folders can make reconciliation harder.
- SQLite and library state can diverge if files are moved outside the app.

## Follow-Ups

- Add configurable library root validation in Settings.
- Add library repair/reconcile tools.
- Add duplicate title handling that preserves source/manga identity.
- Add import existing library workflow.
