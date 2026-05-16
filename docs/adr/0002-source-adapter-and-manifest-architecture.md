# ADR 0002: Source Adapter and Manifest Architecture

## Status

Accepted

## Context

The project must support many manga/manhwa sources and make it easy to add more. Sources vary widely:

- Some have stable public APIs.
- Some are static or mostly static HTML.
- Some use common WordPress/Madara-style structures.
- Some use client-rendered apps with embedded JSON or XHR calls.
- Some block automated requests, require sign-in, or change markup frequently.

A single hard-coded crawler approach would be brittle. A fully self-adaptive crawler is aspirational, but it still needs a stable contract and validation path.

## Decision

Use a tiered source architecture:

1. Native API adapters for sources with stable public APIs.
2. Declarative manifests for HTML/selectors and URL templates.
3. Adaptive/generated manifests from probing a user-provided source URL.

All tiers implement the same `SourceAdapter` contract:

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

## Consequences

### Positive

- GUI and downloader do not need to know whether a source is native, manifest, or adaptive.
- Native adapters can handle custom API flows cleanly.
- Manifests allow new source presets with little or no code.
- Generated manifests can be saved and reviewed.
- Capabilities and health/review state can be shown in the GUI.

### Negative

- Manifest selectors can become stale.
- Different sources have different meanings for favorites, rating, views, and periods.
- Adaptive probing requires confidence scoring and should not silently enable low-confidence sources.
- Some sources may require rendered DOM or network sniffing that is not yet fully implemented.

## Follow-Ups

- Persist generated manifests with confidence history.
- Add UI editing for manifest selectors/templates.
- Add mock-source integration tests for static HTML, XHR, lazy images, broken images, and pagination.
- Add source-specific cooldown and health telemetry to the Sources view.
