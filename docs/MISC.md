# Miscellaneous Notes

This document collects practical notes that do not belong in the main architecture document or ADRs yet.

## How Electron Works

Electron is effectively Chromium plus Node.js plus desktop APIs packaged as a desktop application runtime.

In MangaDL, Electron is split into three layers.

### Main Process

File:

```text
apps/desktop/src/main/main.ts
```

The main process is the desktop app controller. It:

- Creates the app window.
- Opens and manages SQLite.
- Owns the downloader queue.
- Performs filesystem operations.
- Opens local folders.
- Creates source sign-in windows.
- Owns per-source Electron sessions and cookies.
- Handles IPC requests from the renderer.

### Preload Script

File:

```text
apps/desktop/src/preload/preload.mts
```

The preload script is the safe bridge between the browser UI and the privileged main process. It exposes a small API on:

```ts
window.mangadl
```

For example, the React renderer can call:

```ts
window.mangadl.downloads.add(...)
```

The preload script forwards that call to Electron main through IPC.

### Renderer

File:

```text
apps/desktop/src/renderer/App.tsx
```

The renderer is the React UI running inside Chromium. It displays Search, Manga Detail, Downloads, Library, Sources, and Settings.

The renderer does not directly use Node filesystem APIs. It asks Electron main to do privileged work through the preload bridge.

The high-level flow is:

```text
React UI
  -> preload bridge
  -> Electron IPC
  -> main process
  -> filesystem / SQLite / downloads / source sessions
```

## Running In Development

Use:

```powershell
npm run dev
```

This command:

1. Builds the shared packages.
2. Starts the Vite dev server for the React renderer.
3. Launches Electron pointed at the Vite dev server.

Use the Electron window for the app. Opening the Vite URL in a normal browser cannot access `window.mangadl`, SQLite, filesystem operations, downloader controls, or Electron source sessions.

## Running The Built App Locally

Build first:

```powershell
npm run build
```

Then start the desktop app from compiled output:

```powershell
npm run start -w @mangadl/desktop
```

This runs Electron against the built main/preload/renderer output. It is useful for testing production behavior before packaging.

## Publishing To Other Desktops

The project currently builds app code, but it does not yet package an installer or standalone executable.

To distribute MangaDL to another desktop, add a packaging tool such as:

- `electron-builder`
- Electron Forge

For this project, `electron-builder` is likely the simplest Windows-first choice.

Example install command:

```powershell
npm install -D electron-builder
```

Example packaging config direction for `apps/desktop/package.json`:

```json
{
  "scripts": {
    "pack": "npm run build && electron-builder --dir",
    "dist": "npm run build && electron-builder"
  },
  "build": {
    "appId": "com.mangadl.desktop",
    "productName": "MangaDL",
    "directories": {
      "output": "../../release"
    },
    "files": [
      "dist/**",
      "dist-renderer/**",
      "package.json"
    ],
    "win": {
      "target": ["nsis", "portable"]
    }
  }
}
```

Then a Windows installer build would be:

```powershell
npm run dist -w @mangadl/desktop
```

Expected output would be under a release folder, for example:

```text
release/
  MangaDL Setup 0.1.0.exe
  MangaDL 0.1.0.exe
```

## Packaging Caveats

Packaging needs to be tested rather than assumed because this is an npm workspace app. Electron needs:

- Compiled main and preload output.
- Built renderer assets.
- Runtime dependencies.
- Correct workspace package resolution.
- Native/runtime modules included correctly.

Before publishing, the default download root should also become portable. It currently defaults to:

```text
C:\Users\gunka\OneDrive\manga
```

That is correct for the current development machine but wrong for other users. A publish-ready app should resolve the current user's OneDrive folder when possible, fall back to a normal user data/documents path, and still allow Settings to override it.

For example, a portable default strategy could be:

1. Detect current user's OneDrive path.
2. Use `<OneDrive>\manga` when available.
3. Fall back to `<User Documents>\MangaDL\manga`.
4. Allow the user to change it in Settings.

## What Other Users Need

If packaged correctly, other desktop users should not need Node.js installed. They should be able to install or run the packaged app directly.

Runtime data on their machine would be separate:

- SQLite app data goes under that user's Electron app data folder.
- Downloaded manga goes under their configured library root.
- Source sign-in sessions/cookies are stored in their local Electron profile partitions.
