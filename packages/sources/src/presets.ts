import type { SourceManifest } from "@mangadl/core";

const wordpressMadara = {
  browse: {
    pathTemplate: "/manga/page/{page}/",
    pageStart: 1,
    sortTemplates: {
      latest: "/manga/page/{page}/?m_orderby=latest",
      favorites: "/manga/page/{page}/?m_orderby=trending",
      rating: "/manga/page/{page}/?m_orderby=rating",
      views: {
        week: "/manga/page/{page}/?m_orderby=views",
        month: "/manga/page/{page}/?m_orderby=views",
        year: "/manga/page/{page}/?m_orderby=views",
        all: "/manga/page/{page}/?m_orderby=views"
      }
    },
    itemSelector: ".page-item-detail, .c-tabs-item__content, .row.c-tabs-item__content, .bsx, article",
    title: { selector: "a, .post-title a, .tt", attr: "title", fallbackAttr: ["aria-label"] },
    url: { selector: "a, .post-title a", attr: "href", transform: "absolute-url" as const },
    cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" as const },
    description: { selector: ".post-content, .summary, .excerpt" }
  },
  search: {
    pathTemplate: "/?s={query}&post_type=wp-manga",
    itemSelector: ".c-tabs-item__content, .row.c-tabs-item__content, .page-item-detail, .bsx, article",
    title: { selector: "a, .post-title a, .tt", attr: "title", fallbackAttr: ["aria-label"] },
    url: { selector: "a, .post-title a", attr: "href", transform: "absolute-url" as const },
    cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" as const },
    description: { selector: ".post-content, .summary, .excerpt" }
  },
  manga: {
    title: { selector: "h1, .post-title h1, .entry-title" },
    cover: { selector: ".summary_image img, .thumb img, .poster img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" as const },
    description: { selector: ".description-summary, .summary__content, .entry-content" }
  },
  chapters: {
    itemSelector: ".wp-manga-chapter a, .chapter-list a, .eph-num a, li.wp-manga-chapter",
    title: { selector: "a" },
    url: { selector: "a", attr: "href", transform: "absolute-url" as const },
    chapter: { selector: "a", transform: "number" as const }
  },
  pages: {
    imageSelector: ".reading-content img, .chapter-content img, #readerarea img, .entry-content img, img.wp-manga-chapter-img",
    srcAttrs: ["data-src", "data-lazy-src", "data-original", "src"]
  }
};

export const presetManifests: SourceManifest[] = [
  {
    id: "asurascans",
    displayName: "Asura Scans",
    baseUrl: "https://asuracomic.net",
    hostnames: ["asuracomic.net", "asurascans.com", "asura.gg"],
    enabled: true,
    confidence: 0.55,
    needsReview: true,
    ...wordpressMadara
  },
  {
    id: "mangafire",
    displayName: "MangaFire",
    baseUrl: "https://mangafire.to",
    hostnames: ["mangafire.to"],
    enabled: true,
    confidence: 0.62,
    browse: {
      pathTemplate: "/filter?page={page}",
      sortTemplates: {
        latest: "/filter?sort=updated&page={page}",
        favorites: "/filter?sort=favorites&page={page}",
        rating: "/filter?sort=score&page={page}",
        views: {
          week: "/filter?sort=views_week&page={page}",
          month: "/filter?sort=views_month&page={page}",
          year: "/filter?sort=views_year&page={page}",
          all: "/filter?sort=views&page={page}"
        }
      },
      itemSelector: ".original.card-lg, .manga-list .item, .unit, .book-item",
      title: { selector: "a.name, .name a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.name, .name a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
    },
    search: {
      pathTemplate: "/filter?keyword={query}",
      itemSelector: ".original.card-lg, .manga-list .item, .unit, .book-item",
      title: { selector: "a.name, .name a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.name, .name a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
    },
    manga: {
      title: { selector: "h1, .name, .manga-name" },
      cover: { selector: ".poster img, .info img, img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" },
      description: { selector: ".description, .summary, .content" }
    },
    chapters: {
      itemSelector: ".chapters a, .chapter-list a, .episode-list a, a[href*='chapter']",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: "#readerarea img, .reader-area img, .page-img, img[data-src]",
      srcAttrs: ["data-src", "data-url", "src"]
    }
  },
  {
    id: "bato",
    displayName: "Bato.to",
    baseUrl: "https://bato.to",
    hostnames: ["bato.to", "batotoo.com", "mto.to"],
    enabled: true,
    confidence: 0.58,
    needsReview: true,
    browse: {
      pathTemplate: "/browse?page={page}",
      sortTemplates: {
        latest: "/browse?sort=updated&page={page}",
        favorites: "/browse?sort=follows&page={page}",
        rating: "/browse?sort=rating&page={page}",
        views: {
          week: "/browse?sort=views-week&page={page}",
          month: "/browse?sort=views-month&page={page}",
          year: "/browse?sort=views-year&page={page}",
          all: "/browse?sort=views&page={page}"
        }
      },
      itemSelector: ".item, .series-list .item, .comic-item, .media",
      title: { selector: "a.item-title, .item-title a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.item-title, .item-title a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
    },
    search: {
      pathTemplate: "/search?word={query}",
      itemSelector: ".item, .series-list .item, .comic-item, .media",
      title: { selector: "a.item-title, .item-title a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.item-title, .item-title a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
    },
    manga: {
      title: { selector: "h1, .item-title, .series-title" },
      cover: { selector: ".attr-cover img, .poster img, img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" },
      description: { selector: ".limit-html, .summary, .description" }
    },
    chapters: {
      itemSelector: "a[href*='/chapter/'], .episode-list a, .chapter-list a",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: "img.page-img, .reader-area img, #viewer img, img[data-src]",
      srcAttrs: ["data-src", "data-url", "src"]
    }
  },
  {
    id: "comick",
    displayName: "ComicK",
    baseUrl: "https://comick.io",
    hostnames: ["comick.io", "comick.app"],
    enabled: true,
    confidence: 0.52,
    needsReview: true,
    browse: {
      pathTemplate: "/comic?page={page}",
      sortTemplates: {
        latest: "/comic?sort=uploaded&page={page}",
        favorites: "/comic?sort=follow&page={page}",
        rating: "/comic?sort=rating&page={page}",
        views: {
          week: "/comic?sort=view&time=week&page={page}",
          month: "/comic?sort=view&time=month&page={page}",
          year: "/comic?sort=view&time=year&page={page}",
          all: "/comic?sort=view&page={page}"
        }
      },
      itemSelector: "a[href*='/comic/'], .comic-item, article",
      title: { selector: "a, h3, h4", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a[href*='/comic/']", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" }
    },
    search: {
      pathTemplate: "/search?q={query}",
      itemSelector: "a[href*='/comic/'], .comic-item, article",
      title: { selector: "a, h3, h4", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a[href*='/comic/']", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" }
    },
    manga: {
      title: { selector: "h1, h2" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" },
      description: { selector: ".comic-desc, .description, [data-test='description']" }
    },
    chapters: {
      itemSelector: "a[href*='/comic/'][href*='chapter'], a[href*='/chapter/']",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: "img[src*='meo'], img[data-src], .reader img",
      srcAttrs: ["src", "data-src"]
    }
  },
  {
    id: "manganato",
    displayName: "Manganato / Mangakakalot",
    baseUrl: "https://manganato.com",
    hostnames: ["manganato.com", "chapmanganato.to", "mangakakalot.com"],
    enabled: true,
    confidence: 0.7,
    browse: {
      pathTemplate: "/genre-all/{page}",
      sortTemplates: {
        latest: "/genre-all/{page}?type=latest",
        favorites: "/genre-all/{page}?type=topview",
        rating: "/genre-all/{page}?type=rating",
        views: {
          week: "/genre-all/{page}?type=topview",
          month: "/genre-all/{page}?type=topview",
          year: "/genre-all/{page}?type=topview",
          all: "/genre-all/{page}?type=topview"
        }
      },
      itemSelector: ".content-genres-item, .panel-content-genres .genres-item, .story_item",
      title: { selector: "a.genres-item-name, h3 a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.genres-item-name, h3 a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" },
      description: { selector: ".genres-item-description, .story_item_right" }
    },
    search: {
      pathTemplate: "/search/story/{query}",
      itemSelector: ".search-story-item, .panel-search-story .story_item",
      title: { selector: "a.item-title, h3 a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.item-title, h3 a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" },
      description: { selector: ".story_item_right, .item-description" }
    },
    manga: {
      title: { selector: "h1, .story-info-right h1" },
      cover: { selector: ".info-image img, .story-info-left img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" },
      description: { selector: "#panel-story-info-description, .panel-story-info-description" }
    },
    chapters: {
      itemSelector: ".row-content-chapter li a, .chapter-list .row a, a[href*='chapter']",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: ".container-chapter-reader img, .chapter-content img",
      srcAttrs: ["src", "data-src"]
    }
  },
  {
    id: "mangabuddy",
    displayName: "MangaBuddy",
    baseUrl: "https://mangabuddy.com",
    hostnames: ["mangabuddy.com"],
    enabled: true,
    confidence: 0.62,
    browse: {
      pathTemplate: "/manga?page={page}",
      sortTemplates: {
        latest: "/manga?sort=updated&page={page}",
        favorites: "/manga?sort=popular&page={page}",
        rating: "/manga?sort=rating&page={page}",
        views: {
          week: "/manga?sort=views-week&page={page}",
          month: "/manga?sort=views-month&page={page}",
          year: "/manga?sort=views-year&page={page}",
          all: "/manga?sort=views&page={page}"
        }
      },
      itemSelector: ".book-item, .manga-list .item, .list-item",
      title: { selector: "a.book-title, .name a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.book-title, .name a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
    },
    search: {
      pathTemplate: "/search?q={query}",
      itemSelector: ".book-item, .manga-list .item, .list-item",
      title: { selector: "a.book-title, .name a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a.book-title, .name a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" }
    },
    manga: {
      title: { selector: "h1, .name" },
      cover: { selector: ".img-cover img, .cover img, img", attr: "data-src", fallbackAttr: ["src"], transform: "absolute-url" },
      description: { selector: ".summary, .content, .description" }
    },
    chapters: {
      itemSelector: ".chapter-list a, .list-chapters a, a[href*='chapter']",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: ".reader-content img, .chapter-content img, #readerarea img, img[data-src]",
      srcAttrs: ["data-src", "src"]
    }
  },
  {
    id: "mangakatana",
    displayName: "MangaKatana",
    baseUrl: "https://mangakatana.com",
    hostnames: ["mangakatana.com"],
    enabled: true,
    confidence: 0.64,
    browse: {
      pathTemplate: "/manga/page/{page}",
      sortTemplates: {
        latest: "/manga/page/{page}?sort=latest",
        favorites: "/manga/page/{page}?sort=popular",
        rating: "/manga/page/{page}?sort=rating",
        views: {
          week: "/manga/page/{page}?sort=views-week",
          month: "/manga/page/{page}?sort=views-month",
          year: "/manga/page/{page}?sort=views-year",
          all: "/manga/page/{page}?sort=views"
        }
      },
      itemSelector: ".item, .manga, .search-list .item",
      title: { selector: "h3 a, .title a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "h3 a, .title a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" }
    },
    search: {
      pathTemplate: "/?search={query}",
      itemSelector: ".item, .manga, .search-list .item",
      title: { selector: "h3 a, .title a, a", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "h3 a, .title a, a", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" }
    },
    manga: {
      title: { selector: "h1, .heading h1" },
      cover: { selector: ".cover img, .summary img, img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" },
      description: { selector: ".summary, .description" }
    },
    chapters: {
      itemSelector: ".chapter a, .chapters a, a[href*='/manga/'][href*='chapter']",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: "#imgs img, .chapter-content img, .reader img",
      srcAttrs: ["data-src", "src"]
    }
  },
  {
    id: "mangasee",
    displayName: "MangaSee / MangaLife",
    baseUrl: "https://mangasee123.com",
    hostnames: ["mangasee123.com", "mangalife.us"],
    enabled: true,
    confidence: 0.42,
    needsReview: true,
    browse: {
      pathTemplate: "/search/?sort=latest&page={page}",
      sortTemplates: {
        latest: "/search/?sort=latest&page={page}",
        favorites: "/search/?sort=popular&page={page}",
        rating: "/search/?sort=rating&page={page}",
        views: {
          week: "/search/?sort=views-week&page={page}",
          month: "/search/?sort=views-month&page={page}",
          year: "/search/?sort=views-year&page={page}",
          all: "/search/?sort=views&page={page}"
        }
      },
      itemSelector: ".SeriesName, a[href*='/manga/'], .listupd .bs",
      title: { selector: "a, .SeriesName", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a[href*='/manga/']", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" }
    },
    search: {
      pathTemplate: "/search/?name={query}",
      itemSelector: ".SeriesName, a[href*='/manga/'], .listupd .bs",
      title: { selector: "a, .SeriesName", attr: "title", fallbackAttr: ["aria-label"] },
      url: { selector: "a[href*='/manga/']", attr: "href", transform: "absolute-url" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" }
    },
    manga: {
      title: { selector: "h1, .SeriesName" },
      cover: { selector: "img", attr: "src", fallbackAttr: ["data-src"], transform: "absolute-url" },
      description: { selector: ".top-5.Content, .summary, .description" }
    },
    chapters: {
      itemSelector: "a[href*='/read-online/'], a[href*='chapter']",
      title: { selector: "a" },
      url: { selector: "a", attr: "href", transform: "absolute-url" },
      chapter: { selector: "a", transform: "number" }
    },
    pages: {
      imageSelector: "#PageContainer img, .chapter-content img, .reader img",
      srcAttrs: ["src", "data-src"]
    }
  },
  {
    id: "manhwatop",
    displayName: "ManhwaTop",
    baseUrl: "https://manhwatop.com",
    hostnames: ["manhwatop.com"],
    enabled: true,
    confidence: 0.56,
    needsReview: true,
    ...wordpressMadara
  },
  {
    id: "flame-reaper-style",
    displayName: "Reaper/Flame-style Reader",
    baseUrl: "https://flamecomics.xyz",
    hostnames: ["flamecomics.xyz", "reaperscans.com", "reapercomics.com"],
    enabled: true,
    confidence: 0.45,
    needsReview: true,
    ...wordpressMadara
  }
];
