# ADR 0001: TypeScript, Electron, React, and Vite

## Status

Accepted

## Context

MangaDL needs a desktop GUI, filesystem access, persistent background downloads, source-specific browser sessions, and a plugin-like crawler/runtime architecture. The user allowed TypeScript/Node or Python, with preference left to the implementation.

Python is strong for scraping and scripting, but a polished desktop reader/downloader would need additional GUI packaging, browser session management, and a separate frontend story. A TypeScript/Electron stack keeps desktop APIs, renderer UI, shared models, and crawler/downloader code in one language and one package graph.

## Decision

Use:

- TypeScript for all app, crawler, downloader, and persistence code.
- Electron for desktop shell, filesystem access, auth/session windows, and IPC.
- React for the renderer GUI.
- Vite for renderer development and production bundling.
- npm workspaces for package boundaries.

## Consequences

### Positive

- Shared types across main, preload, renderer, source adapters, downloader, and persistence.
- Electron sessions can persist per-source cookies and sign-in state.
- The renderer can remain a normal web UI while privileged operations stay in main.
- Vite gives fast renderer development and small production bundles.
- Source adapters and manifests can run in the Node/Electron environment without a separate service.

### Negative

- Electron adds runtime size and security responsibilities.
- Browser/CAPTCHA-heavy sources remain unreliable unless the user signs in manually.
- Node 24's SQLite API is experimental.
- Frontend and backend concerns share one repo, requiring clear package boundaries.

## Follow-Ups

- Add packaged app builds when the core downloader/source flows stabilize.
- Consider CI for Windows build/test coverage.
- Revisit SQLite dependency if Node's built-in API changes materially.
