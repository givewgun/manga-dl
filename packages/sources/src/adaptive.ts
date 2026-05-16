import {
  type AdaptiveProbeResult,
  type SourceContext,
  type SourceManifest
} from "@mangadl/core";
import * as cheerio from "cheerio";
import { fetchText } from "./http.js";
import { ManifestSourceAdapter } from "./manifestAdapter.js";

const CHAPTER_LINK_HINT = /chapter|episode|ch[-_\s]?\d|capitulo|read/i;
const IMAGE_HINT = /reader|chapter|page|manga|wp-manga/i;

export class AdaptiveManifestBuilder {
  async probe(url: string, ctx: SourceContext): Promise<AdaptiveProbeResult> {
    const messages: string[] = [];
    const normalizedUrl = new URL(url).toString();
    const html = await fetchText(ctx, normalizedUrl);
    const $ = cheerio.load(html);
    const origin = new URL(normalizedUrl).origin;
    const host = new URL(normalizedUrl).hostname.replace(/^www\./, "");
    const titleSelector = chooseTitleSelector($);
    const chapterSelector = chooseChapterSelector($);
    const imageSelector = chooseImageSelector($);
    const confidence =
      0.2 +
      (titleSelector ? 0.2 : 0) +
      (chapterSelector ? 0.25 : 0) +
      (imageSelector ? 0.25 : 0);

    if (!chapterSelector) messages.push("No confident chapter-list selector found.");
    if (!imageSelector) messages.push("No confident page image selector found on the probed URL.");

    const manifest: SourceManifest = {
      id: `adaptive-${host.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      displayName: titleFromDocument($) ?? host,
      baseUrl: origin,
      hostnames: [host],
      enabled: confidence >= 0.6,
      confidence,
      needsReview: confidence < 0.75,
      search: {
        pathTemplate: "/?s={query}",
        itemSelector: "article, .bsx, .item, .page-item-detail, a[href*='manga'], a[href*='series']",
        title: { selector: "a, h2, h3", attr: "title", fallbackAttr: ["aria-label"] },
        url: { selector: "a", attr: "href", transform: "absolute-url" },
        cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
      },
      manga: {
        title: { selector: titleSelector ?? "h1, h2, .entry-title" },
        cover: { selector: "img", attr: "data-src", fallbackAttr: ["data-original", "src"], transform: "absolute-url" },
        description: { selector: ".summary, .description, .entry-content, .content" }
      },
      chapters: {
        itemSelector: chapterSelector ?? "a[href*='chapter'], a[href*='episode']",
        title: { selector: "a" },
        url: { selector: "a", attr: "href", transform: "absolute-url" },
        chapter: { selector: "a", transform: "number" }
      },
      pages: {
        imageSelector: imageSelector ?? ".reading-content img, .chapter-content img, #readerarea img, img[data-src]",
        srcAttrs: ["data-src", "data-lazy-src", "data-original", "src"]
      }
    };

    const adapter = new ManifestSourceAdapter(manifest);
    let sampleManga;
    let sampleChapter;
    try {
      sampleManga = await adapter.getManga({ sourceId: manifest.id, mangaId: normalizedUrl, url: normalizedUrl }, ctx);
      const firstChapter = sampleManga.chapters?.[0];
      if (firstChapter) {
        sampleChapter = await adapter.resolveChapter(firstChapter, ctx);
      }
    } catch (error) {
      messages.push(`Validation warning: ${error instanceof Error ? error.message : String(error)}`);
      manifest.enabled = false;
      manifest.needsReview = true;
    }

    return { manifest, sampleManga, sampleChapter, messages };
  }
}

function chooseTitleSelector($: cheerio.CheerioAPI): string | undefined {
  for (const selector of ["h1", ".entry-title", ".post-title h1", ".manga-title", ".series-title"]) {
    if ($(selector).first().text().trim()) return selector;
  }
  return undefined;
}

function chooseChapterSelector($: cheerio.CheerioAPI): string | undefined {
  const candidates = [
    ".wp-manga-chapter a",
    ".chapter-list a",
    ".chapters a",
    ".episode-list a",
    "a[href*='chapter']",
    "a[href*='episode']"
  ];

  return candidates
    .map((selector) => ({
      selector,
      score: $(selector)
        .toArray()
        .filter((el) => CHAPTER_LINK_HINT.test($(el).text()) || CHAPTER_LINK_HINT.test($(el).attr("href") ?? ""))
        .length
    }))
    .sort((a, b) => b.score - a.score)
    .find((candidate) => candidate.score >= 2)?.selector;
}

function chooseImageSelector($: cheerio.CheerioAPI): string | undefined {
  const candidates = [
    ".reading-content img",
    ".chapter-content img",
    "#readerarea img",
    ".reader-area img",
    "#viewer img",
    "img[data-src]",
    "img"
  ];

  return candidates
    .map((selector) => ({
      selector,
      score: $(selector)
        .toArray()
        .filter((el) => {
          const src = $(el).attr("data-src") ?? $(el).attr("src") ?? "";
          const parentClass = $(el).parent().attr("class") ?? "";
          return IMAGE_HINT.test(src) || IMAGE_HINT.test(parentClass);
        }).length
    }))
    .sort((a, b) => b.score - a.score)
    .find((candidate) => candidate.score >= 2)?.selector;
}

function titleFromDocument($: cheerio.CheerioAPI): string | undefined {
  const h1 = $("h1").first().text().trim();
  if (h1) return h1;
  const title = $("title").first().text().trim();
  return title || undefined;
}
