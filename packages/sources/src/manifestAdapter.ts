import {
  type ChapterAssetPlan,
  type ChapterRef,
  type MangaBrowseQuery,
  type MangaBrowseResult,
  type MangaDetails,
  type MangaRef,
  type MangaSearchQuery,
  type MangaSummary,
  type ManifestBrowseRule,
  type ManifestSearchRule,
  type ManifestTextSelector,
  type SourceAdapter,
  type SourceCapability,
  type SourceContext,
  type SourceHealth,
  type SourceManifest
} from "@mangadl/core";
import * as cheerio from "cheerio";
import { absoluteUrl, fetchText, sameHost } from "./http.js";

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioElement = any;

export class ManifestSourceAdapter implements SourceAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly capabilities: SourceCapability[];

  constructor(readonly manifest: SourceManifest) {
    this.id = manifest.id;
    this.displayName = manifest.displayName;
    this.baseUrl = manifest.baseUrl;
    this.capabilities = [
      manifest.browse || manifest.search ? "browse" : undefined,
      manifest.search ? "search" : undefined,
      manifest.manga ? "manga-details" : undefined,
      manifest.chapters ? "chapter-list" : undefined,
      manifest.pages ? "chapter-assets" : undefined,
      manifest.needsReview ? "adaptive" : undefined
    ].filter(Boolean) as SourceCapability[];
  }

  match(inputUrl: string): boolean {
    return sameHost(inputUrl, this.manifest.hostnames);
  }

  async browse(query: MangaBrowseQuery, ctx: SourceContext): Promise<MangaBrowseResult> {
    const rule = this.manifest.browse ?? browseFallbackFromSearch(this.manifest.search);
    if (!rule) {
      return {
        items: [],
        page: query.page ?? 1,
        limit: query.limit ?? 24,
        hasNextPage: false,
        notices: [`${this.displayName} does not define a browse feed yet.`]
      };
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = query.limit ?? 24;
    const path = browsePath(rule, query, page);
    const url = new URL(path, this.baseUrl).toString();
    const $ = cheerio.load(await fetchText(ctx, url));
    const items = extractMangaList($, rule, this.id, this.baseUrl, limit);

    return {
      items,
      page,
      limit,
      hasNextPage: items.length >= Math.min(limit, 12),
      notices: query.sort && query.sort !== "default" && !rule.sortTemplates?.[query.sort]
        ? [`${this.displayName} is using its normal paginated site listing for this sort.`]
        : undefined
    };
  }

  async search(query: MangaSearchQuery, ctx: SourceContext): Promise<MangaSummary[]> {
    const rule = this.manifest.search;
    if (!rule) return [];

    const path = rule.pathTemplate.replace("{query}", encodeURIComponent(query.title));
    const url = new URL(path, this.baseUrl).toString();
    const $ = cheerio.load(await fetchText(ctx, url));

    return extractMangaList($, rule, this.id, this.baseUrl, query.limit ?? 25);
  }

  async getManga(ref: MangaRef, ctx: SourceContext): Promise<MangaDetails> {
    const url = ref.url ?? ref.mangaId;
    const $ = cheerio.load(await fetchText(ctx, url));
    const rule = this.manifest.manga;
    const title = rule ? extractValue($, $.root()[0], rule.title, url) : undefined;

    return {
      sourceId: this.id,
      mangaId: ref.mangaId,
      title: title ?? ref.title ?? titleFromUrl(url),
      url,
      coverUrl: rule?.cover ? extractValue($, $.root()[0], rule.cover, url) : undefined,
      description: rule?.description
        ? extractValue($, $.root()[0], rule.description, url)
        : undefined,
      chapters: await this.listChapters({ ...ref, url }, ctx)
    };
  }

  async listChapters(ref: MangaRef, ctx: SourceContext): Promise<ChapterRef[]> {
    const rule = this.manifest.chapters;
    if (!rule) return [];

    const url = ref.url ?? ref.mangaId;
    const $ = cheerio.load(await fetchText(ctx, url));
    const chapters = $(rule.itemSelector)
      .toArray()
      .map((el): ChapterRef | undefined => {
        const chapterUrl = extractValue($, el, rule.url, url);
        if (!chapterUrl) return undefined;
        const title = extractValue($, el, rule.title, url);
        return {
          sourceId: this.id,
          mangaId: ref.mangaId,
          mangaTitle: ref.title,
          chapterId: chapterUrl,
          url: chapterUrl,
          title,
          chapter: rule.chapter ? extractValue($, el, rule.chapter, url) : inferChapterNumber(title),
          language: rule.language ? extractValue($, el, rule.language, url) : undefined
        };
      })
      .filter((chapter): chapter is ChapterRef => Boolean(chapter));

    return dedupeBy(chapters, (chapter) => chapter.url ?? `${chapter.chapterId}-${chapter.title}`)
      .map((chapter, index) => ({ ...chapter, chapter: chapter.chapter ?? String(index + 1) }));
  }

  async resolveChapter(ref: ChapterRef, ctx: SourceContext): Promise<ChapterAssetPlan> {
    const rule = this.manifest.pages;
    if (!rule) {
      throw new Error(`${this.displayName} does not define a page resolver`);
    }

    const url = ref.url ?? ref.chapterId;
    const $ = cheerio.load(await fetchText(ctx, url));
    const pages = $(rule.imageSelector)
      .toArray()
      .map((el, index) => {
        const raw = firstAttr($, el, rule.srcAttrs);
        const pageUrl = absoluteUrl(url, raw);
        if (!pageUrl) return undefined;
        return {
          index,
          url: pageUrl,
          headers: { referer: url }
        };
      })
      .filter((page): page is NonNullable<typeof page> => Boolean(page));

    if (pages.length === 0) {
      throw new Error(`No readable pages found for ${url}`);
    }

    return {
      sourceId: this.id,
      manga: {
        sourceId: this.id,
        mangaId: ref.mangaId,
        title: ref.mangaTitle,
        url: ref.mangaId
      },
      chapter: ref,
      pages,
      referer: url,
      headers: { referer: url }
    };
  }

  async health(ctx: SourceContext): Promise<SourceHealth> {
    try {
      const response = await ctx.fetch(this.baseUrl, {
        method: "GET",
        signal: ctx.signal,
        headers: { "user-agent": ctx.userAgent }
      });
      if (response.ok) return this.manifest.needsReview ? "needs-review" : "ok";
      return response.status >= 500 ? "degraded" : "offline";
    } catch {
      return "offline";
    }
  }
}

function extractMangaList(
  $: CheerioRoot,
  rule: ManifestSearchRule,
  sourceId: string,
  baseUrl: string,
  limit: number
): MangaSummary[] {
  return dedupeBy(
    $(rule.itemSelector)
      .toArray()
      .slice(0, limit)
      .map((el, index) => {
        const title = extractValue($, el, rule.title, baseUrl) ?? `Result ${index + 1}`;
        const resultUrl = extractValue($, el, rule.url, baseUrl) ?? baseUrl;
        return {
          sourceId,
          mangaId: resultUrl,
          title,
          url: resultUrl,
          coverUrl: rule.cover ? extractValue($, el, rule.cover, baseUrl) : undefined,
          description: rule.description
            ? extractValue($, el, rule.description, baseUrl)
            : undefined
        };
      }),
    (item) => item.url ?? item.mangaId
  );
}

function browseFallbackFromSearch(search: ManifestSearchRule | undefined): ManifestBrowseRule | undefined {
  if (!search) return undefined;
  return {
    ...search,
    pathTemplate: "/page/{page}/"
  };
}

function browsePath(rule: ManifestBrowseRule, query: MangaBrowseQuery, page: number): string {
  const sort = query.sort ?? "default";
  const sortTemplate = rule.sortTemplates?.[sort];
  const template = typeof sortTemplate === "string"
    ? sortTemplate
    : sortTemplate?.[query.period ?? "all"] ?? rule.pathTemplate;
  const displayPage = page + (rule.pageStart ?? 1) - 1;
  return template
    .replaceAll("{page}", String(displayPage))
    .replaceAll("{sort}", sort)
    .replaceAll("{period}", query.period ?? "all");
}

function extractValue(
  $: CheerioRoot,
  context: CheerioElement | undefined,
  rule: ManifestTextSelector,
  baseUrl: string
): string | undefined {
  if (!context) return undefined;
  const target = $(context).find(rule.selector).first();
  const node = target.length > 0 ? target : $(context).filter(rule.selector).first();
  const attrs = [rule.attr, ...(rule.fallbackAttr ?? [])].filter(Boolean) as string[];
  let value: string | undefined;

  for (const attr of attrs) {
    value = node.attr(attr);
    if (value) break;
  }

  value ??= node.text();
  value = value?.trim();
  if (!value) return undefined;

  if (rule.transform === "absolute-url" || attrs.includes("href") || attrs.includes("src")) {
    return absoluteUrl(baseUrl, value);
  }

  if (rule.transform === "number") {
    return inferChapterNumber(value);
  }

  return value;
}

function firstAttr($: CheerioRoot, el: CheerioElement, attrs: string[]): string | undefined {
  for (const attr of attrs) {
    const value = $(el).attr(attr);
    if (value && !value.startsWith("data:image")) {
      return value;
    }
  }
  return undefined;
}

function inferChapterNumber(value: string | undefined): string | undefined {
  const match = value?.match(/chapter\s*([0-9]+(?:\.[0-9]+)?)/i) ?? value?.match(/\b([0-9]+(?:\.[0-9]+)?)\b/);
  return match?.[1];
}

function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/g, "");
    const last = pathname.split("/").filter(Boolean).at(-1);
    return last?.replace(/[-_]+/g, " ") ?? url;
  } catch {
    return url;
  }
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
