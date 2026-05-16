import {
  type AuthStatus,
  type ChapterAssetPlan,
  type ChapterRef,
  type MangaBrowseQuery,
  type MangaBrowseResult,
  type MangaBrowseSort,
  type MangaDetails,
  type MangaRef,
  type MangaSearchQuery,
  type MangaSummary,
  type SourceAdapter,
  type SourceCapability,
  type SourceContext,
  type SourceHealth
} from "@mangadl/core";
import { fetchJson } from "./http.js";

const API = "https://api.mangadex.org";
const COVER_BASE = "https://uploads.mangadex.org/covers";

export class MangaDexAdapter implements SourceAdapter {
  readonly id = "mangadex";
  readonly displayName = "MangaDex";
  readonly baseUrl = "https://mangadex.org";
  readonly capabilities: SourceCapability[] = [
    "browse",
    "search",
    "manga-details",
    "chapter-list",
    "chapter-assets",
    "auth"
  ];

  match(inputUrl: string): boolean {
    try {
      const host = new URL(inputUrl).hostname;
      return host === "mangadex.org" || host === "api.mangadex.org";
    } catch {
      return false;
    }
  }

  async browse(query: MangaBrowseQuery, ctx: SourceContext): Promise<MangaBrowseResult> {
    const limit = clamp(query.limit ?? 24, 1, 100);
    const page = Math.max(1, query.page ?? 1);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String((page - 1) * limit));
    params.append("includes[]", "cover_art");
    params.append("availableTranslatedLanguage[]", query.language ?? ctx.language);
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");
    params.append("contentRating[]", "erotica");
    const order = mangaDexOrder(query.sort ?? "default");
    params.set(`order[${order}]`, "desc");

    const payload = await fetchJson<MangaDexListResponse>(ctx, `${API}/manga?${params}`);
    return {
      items: payload.data.map((item) => mapManga(item)),
      page,
      limit,
      total: payload.total,
      hasNextPage: page * limit < payload.total,
      notices: order === "followedCount" && query.sort === "views"
        ? ["MangaDex does not expose view counts by period through the public manga list API, so this view uses followed-count ranking."]
        : undefined
    };
  }

  async search(query: MangaSearchQuery, ctx: SourceContext): Promise<MangaSummary[]> {
    const params = new URLSearchParams();
    params.set("title", query.title);
    params.set("limit", String(query.limit ?? 20));
    params.append("includes[]", "cover_art");
    params.append("availableTranslatedLanguage[]", query.language ?? ctx.language);
    params.set("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");
    params.append("contentRating[]", "erotica");

    const payload = await fetchJson<MangaDexListResponse>(ctx, `${API}/manga?${params}`);
    return payload.data.map((item) => mapManga(item));
  }

  async getManga(ref: MangaRef, ctx: SourceContext): Promise<MangaDetails> {
    const payload = await fetchJson<MangaDexEntityResponse<MangaDexManga>>(ctx, `${API}/manga/${ref.mangaId}?includes[]=cover_art`);
    const summary = mapManga(payload.data);
    return {
      ...summary,
      chapters: await this.listChapters(ref, ctx)
    };
  }

  async listChapters(ref: MangaRef, ctx: SourceContext): Promise<ChapterRef[]> {
    const chapters: ChapterRef[] = [];
    const limit = 100;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (chapters.length < total) {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      params.append("translatedLanguage[]", ctx.language);
      params.set("order[chapter]", "asc");
      params.append("includes[]", "scanlation_group");
      const payload = await fetchJson<MangaDexChapterListResponse>(
        ctx,
        `${API}/manga/${ref.mangaId}/feed?${params}`
      );
      total = payload.total;
      chapters.push(
        ...payload.data.map((chapter) => ({
          sourceId: this.id,
          mangaId: ref.mangaId,
          mangaTitle: ref.title,
          chapterId: chapter.id,
          title: chapter.attributes.title || undefined,
          chapter: chapter.attributes.chapter || undefined,
          volume: chapter.attributes.volume || undefined,
          language: chapter.attributes.translatedLanguage,
          publishedAt: chapter.attributes.publishAt,
          url: `https://mangadex.org/chapter/${chapter.id}`
        }))
      );
      offset += payload.data.length;
      if (payload.data.length === 0) break;
    }

    return chapters;
  }

  async resolveChapter(ref: ChapterRef, ctx: SourceContext): Promise<ChapterAssetPlan> {
    const payload = await fetchJson<MangaDexAtHomeResponse>(ctx, `${API}/at-home/server/${ref.chapterId}`);
    const files = payload.chapter.data.length > 0 ? payload.chapter.data : payload.chapter.dataSaver;
    const qualityMode = payload.chapter.data.length > 0 ? "data" : "data-saver";
    const pages = files.map((filename, index) => ({
      index,
      url: `${payload.baseUrl}/${qualityMode}/${payload.chapter.hash}/${filename}`,
      filename
    }));

    return {
      sourceId: this.id,
      manga: {
        sourceId: this.id,
        mangaId: ref.mangaId,
        title: ref.mangaTitle,
        url: `https://mangadex.org/title/${ref.mangaId}`
      },
      chapter: ref,
      pages,
      referer: "https://mangadex.org/",
      headers: { referer: "https://mangadex.org/" }
    };
  }

  async authenticate(): Promise<AuthStatus> {
    return {
      sourceId: this.id,
      signedIn: true,
      message: "MangaDex public API works without sign-in for search and reading.",
      checkedAt: new Date().toISOString()
    };
  }

  async health(ctx: SourceContext): Promise<SourceHealth> {
    try {
      const response = await ctx.fetch(`${API}/ping`, {
        headers: { "user-agent": ctx.userAgent }
      });
      return response.ok ? "ok" : "degraded";
    } catch {
      return "offline";
    }
  }
}

function mapManga(item: MangaDexManga): MangaSummary {
  const title = localized(item.attributes.title) ?? item.id;
  const coverFile = item.relationships.find((rel) => rel.type === "cover_art")?.attributes?.fileName;
  return {
    sourceId: "mangadex",
    mangaId: item.id,
    title,
    url: `https://mangadex.org/title/${item.id}`,
    coverUrl: coverFile ? `${COVER_BASE}/${item.id}/${coverFile}.256.jpg` : undefined,
    description: localized(item.attributes.description),
    status: item.attributes.status,
    tags: item.attributes.tags?.map((tag) => localized(tag.attributes.name)).filter(Boolean) as string[]
  };
}

function localized(map: Record<string, string> | undefined): string | undefined {
  if (!map) return undefined;
  return map.en ?? Object.values(map)[0];
}

function mangaDexOrder(sort: MangaBrowseSort): string {
  switch (sort) {
    case "favorites":
    case "views":
      return "followedCount";
    case "rating":
      return "rating";
    case "latest":
    case "default":
    default:
      return "latestUploadedChapter";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface MangaDexEntityResponse<T> {
  data: T;
}

interface MangaDexListResponse {
  total: number;
  data: MangaDexManga[];
}

interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    description?: Record<string, string>;
    status?: string;
    tags?: Array<{ attributes: { name: Record<string, string> } }>;
  };
  relationships: Array<{
    id: string;
    type: string;
    attributes?: {
      fileName?: string;
    };
  }>;
}

interface MangaDexChapterListResponse {
  total: number;
  data: MangaDexChapter[];
}

interface MangaDexChapter {
  id: string;
  attributes: {
    title?: string | null;
    chapter?: string | null;
    volume?: string | null;
    translatedLanguage?: string;
    publishAt?: string;
  };
}

interface MangaDexAtHomeResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}
