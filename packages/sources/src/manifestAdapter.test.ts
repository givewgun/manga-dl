import { describe, expect, it } from "vitest";
import type { SourceContext, SourceManifest } from "@mangadl/core";
import { ManifestSourceAdapter } from "./manifestAdapter.js";

const manifest: SourceManifest = {
  id: "mock",
  displayName: "Mock Source",
  baseUrl: "https://mock.test",
  hostnames: ["mock.test"],
  enabled: true,
  confidence: 1,
  search: {
    pathTemplate: "/search?q={query}",
    itemSelector: ".result",
    title: { selector: "a", attr: "title" },
    url: { selector: "a", attr: "href", transform: "absolute-url" },
    cover: { selector: "img", attr: "src", transform: "absolute-url" }
  },
  manga: {
    title: { selector: "h1" },
    description: { selector: ".summary" }
  },
  chapters: {
    itemSelector: ".chapter a",
    title: { selector: "a" },
    url: { selector: "a", attr: "href", transform: "absolute-url" },
    chapter: { selector: "a", transform: "number" }
  },
  pages: {
    imageSelector: ".reader img",
    srcAttrs: ["data-src", "src"]
  }
};

const html = `
  <html>
    <body>
      <h1>Mock Manga</h1>
      <p class="summary">A compact fixture.</p>
      <div class="result"><a href="/manga/mock" title="Mock Manga"><img src="/cover.jpg"></a></div>
      <div class="chapter"><a href="/chapter/1">Chapter 1</a></div>
      <div class="chapter"><a href="/chapter/2">Chapter 2</a></div>
      <div class="reader"><img data-src="/001.jpg"><img src="/002.jpg"></div>
    </body>
  </html>`;

const ctx: SourceContext = {
  userAgent: "test",
  language: "en",
  fetch: async () => new Response(html, { status: 200 })
};

describe("ManifestSourceAdapter", () => {
  it("parses search, chapter list, and page assets", async () => {
    const adapter = new ManifestSourceAdapter(manifest);
    const results = await adapter.search({ title: "mock" }, ctx);
    expect(results[0]?.title).toBe("Mock Manga");
    expect(results[0]?.url).toBe("https://mock.test/manga/mock");

    const browse = await adapter.browse({ page: 1, sort: "latest" }, ctx);
    expect(browse.items[0]?.title).toBe("Mock Manga");
    expect(browse.hasNextPage).toBe(false);

    const details = await adapter.getManga(results[0]!, ctx);
    expect(details.chapters).toHaveLength(2);

    const plan = await adapter.resolveChapter(details.chapters![0]!, ctx);
    expect(plan.pages.map((page) => page.url)).toEqual([
      "https://mock.test/001.jpg",
      "https://mock.test/002.jpg"
    ]);
  });
});
