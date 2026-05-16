# ADR 0003: Resilient Downloader Queue

## Status

Accepted

## Context

The downloader is the most important part of the app. It must handle bulk chapter downloads, whole manga downloads, multiple selected manga, flaky networks, rate limits, expired image URLs, and app crashes.

Simple sequential downloads would be too slow. Unbounded parallel downloads would be hostile to sources, unreliable under rate limits, and likely to corrupt local state after interruptions.

## Decision

Implement a persisted queue with bounded parallelism:

- Limit active chapters globally.
- Limit active page downloads globally.
- Limit requests per host.
- Persist jobs and page records in SQLite.
- Retry transient failures with exponential backoff and jitter.
- Treat 429/503 as pressure signals that can trigger source cooldown behavior.
- Pause by stopping new work and allowing in-flight writes to settle.
- Resume by reconciling persisted state with existing files.
- Generate CBZ after page files are complete.

## Consequences

### Positive

- Downloads can continue after app restart.
- Completed files can be skipped instead of downloaded again.
- Bulk operations are fast while still bounded.
- Failure details can be shown in the Downloads view.
- The downloader can re-resolve chapter assets when image URLs expire.

### Negative

- Queue state is more complex than a simple task list.
- File reconciliation needs careful handling to avoid overwriting user data.
- OneDrive sync can introduce file timing/locking behavior.
- Some source failures require adapter-specific repair behavior.

## Follow-Ups

- Add explicit repair action for mismatched files.
- Add per-source cooldown display and controls.
- Add integration tests for interrupted downloads and resume.
- Add speed and ETA metrics from recent page throughput.
