# ADR 0004: Electron IPC and Source Sessions

## Status

Accepted

## Context

The renderer needs to control downloads and display data, but it should not directly access Node, Electron internals, SQLite, or the filesystem. Source authentication must persist cookies/session state and should use the user's own signed-in browser session where needed.

## Decision

Use Electron with:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- A preload bridge exposing `window.mangadl`.
- IPC channel names defined in `@mangadl/core`.
- Electron main handlers for settings, sources, manga, downloads, library, and shell operations.
- Persistent per-source session partitions:

```text
persist:mangadl-source-<sourceId>
```

Sign-in opens an Electron window using the source partition. Source requests later use the same partition via `session.fetch`.

## Consequences

### Positive

- Renderer stays less privileged.
- IPC surface is explicit and typed at the preload boundary.
- Cookies/session state are isolated per source.
- Sign-in does not require MangaDL to store credentials.
- Main process can consistently apply user-agent, timeout, and session behavior.

### Negative

- IPC schemas must stay in sync across core, preload, main, and renderer.
- Electron session data is sensitive local data.
- Debugging preload failures can produce blank or degraded renderer behavior.
- Non-Electron browser tabs cannot use privileged app features.

## Follow-Ups

- Replace broad `any` types in renderer global declarations with generated bridge types.
- Add runtime validation for IPC payloads.
- Add source session management UI for clearing cookies/session data.
- Add renderer error boundary and main-process error reporting panel.
