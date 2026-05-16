import {
  APP_USER_AGENT,
  type AdaptiveProbeResult,
  type MangaBrowseQuery,
  type MangaBrowseResult,
  type MangaDetails,
  type MangaRef,
  type MangaSearchQuery,
  type MangaSummary,
  type SourceAdapter,
  type SourceContext,
  type SourceDescriptor,
  type SourceHealth,
  type SourceManifest
} from "@mangadl/core";
import { AdaptiveManifestBuilder } from "./adaptive.js";
import { ManifestSourceAdapter } from "./manifestAdapter.js";
import { MangaDexAdapter } from "./mangadex.js";
import { presetManifests } from "./presets.js";

export class SourceRegistry {
  private readonly adapters = new Map<string, SourceAdapter>();
  private readonly adaptive = new AdaptiveManifestBuilder();

  constructor(manifests: SourceManifest[] = []) {
    this.register(new MangaDexAdapter());
    for (const manifest of [...presetManifests, ...manifests]) {
      if (manifest.enabled || manifest.needsReview) {
        this.register(new ManifestSourceAdapter(manifest));
      }
    }
  }

  register(adapter: SourceAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  list(): SourceDescriptor[] {
    return [...this.adapters.values()].map((adapter) => ({
      id: adapter.id,
      displayName: adapter.displayName,
      baseUrl: adapter.baseUrl,
      capabilities: adapter.capabilities,
      health: adapter.capabilities.includes("adaptive") ? "needs-review" : "ok",
      needsReview: adapter.capabilities.includes("adaptive")
    }));
  }

  get(id: string): SourceAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown source ${id}`);
    return adapter;
  }

  findByUrl(url: string): SourceAdapter | undefined {
    return [...this.adapters.values()].find((adapter) => adapter.match(url));
  }

  async browse(
    query: MangaBrowseQuery,
    ctxInput: SourceContext | ((sourceId: string) => SourceContext)
  ): Promise<MangaBrowseResult> {
    const adapters = query.sourceIds?.length
      ? query.sourceIds.map((id) => this.get(id)).filter((adapter) => adapter.capabilities.includes("browse"))
      : [...this.adapters.values()].filter((adapter) => adapter.capabilities.includes("browse"));

    const limit = query.limit ?? 24;
    const perSourceLimit = Math.max(6, Math.ceil(limit / Math.max(1, adapters.length)));
    const results = await Promise.allSettled(
      adapters.map((adapter) =>
        adapter.browse(
          { ...query, limit: perSourceLimit },
          ctxForSource(ctxInput, adapter.id, query.language)
        )
      )
    );
    const pages = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const failures = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${adapters[index]?.displayName ?? "Source"} browse failed: ${messageFromError(result.reason)}`]
        : []
    );

    return {
      items: pages.flatMap((page) => page.items).slice(0, limit),
      page: query.page ?? 1,
      limit,
      total: singleSource(adapters, pages)?.total,
      hasNextPage: pages.some((page) => page.hasNextPage),
      notices: [
        ...pages.flatMap((page) => page.notices ?? []),
        ...failures
      ].slice(0, 8)
    };
  }

  async search(
    query: MangaSearchQuery,
    ctxInput: SourceContext | ((sourceId: string) => SourceContext)
  ): Promise<MangaSummary[]> {
    const adapters = query.sourceIds?.length
      ? query.sourceIds.map((id) => this.get(id))
      : [...this.adapters.values()].filter((adapter) => adapter.capabilities.includes("search"));

    const results = await Promise.allSettled(
      adapters.map((adapter) => adapter.search(query, ctxForSource(ctxInput, adapter.id, query.language)))
    );

    return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  }

  async getManga(ref: MangaRef, ctx: SourceContext): Promise<MangaDetails> {
    return this.get(ref.sourceId).getManga(ref, ctx);
  }

  async health(ctxFactory: (sourceId: string) => SourceContext): Promise<Record<string, SourceHealth>> {
    const entries = await Promise.all(
      [...this.adapters.values()].map(async (adapter) => {
        const health = adapter.health ? await adapter.health(ctxFactory(adapter.id)) : "ok";
        return [adapter.id, health] as const;
      })
    );
    return Object.fromEntries(entries);
  }

  async probe(url: string, ctx: SourceContext): Promise<AdaptiveProbeResult> {
    const result = await this.adaptive.probe(url, ctx);
    this.register(new ManifestSourceAdapter(result.manifest));
    return result;
  }
}

export function createDefaultSourceContext(
  fetchImpl: SourceContext["fetch"] = fetch,
  language = "en"
): SourceContext {
  return {
    fetch: fetchImpl,
    userAgent: APP_USER_AGENT,
    language
  };
}

function ctxForLanguage(ctx: SourceContext, language: string | undefined): SourceContext {
  return language ? { ...ctx, language } : ctx;
}

function ctxForSource(
  ctxInput: SourceContext | ((sourceId: string) => SourceContext),
  sourceId: string,
  language: string | undefined
): SourceContext {
  const ctx = typeof ctxInput === "function" ? ctxInput(sourceId) : ctxInput;
  return ctxForLanguage(ctx, language);
}

function singleSource(adapters: SourceAdapter[], pages: MangaBrowseResult[]): MangaBrowseResult | undefined {
  return adapters.length === 1 ? pages[0] : undefined;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
