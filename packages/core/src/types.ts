export type SourceCapability =
  | "browse"
  | "search"
  | "manga-details"
  | "chapter-list"
  | "chapter-assets"
  | "auth"
  | "adaptive";

export type SourceHealth = "ok" | "degraded" | "needs-review" | "offline";

export type DownloadStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PageDownloadStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type ReaderMode = "downloaded" | "online";

export interface MangaSearchQuery {
  title: string;
  limit?: number;
  language?: string;
  sourceIds?: string[];
}

export type MangaBrowseSort = "default" | "latest" | "favorites" | "rating" | "views";

export type MangaBrowsePeriod = "week" | "month" | "year" | "all";

export interface MangaBrowseQuery {
  sourceIds?: string[];
  page?: number;
  limit?: number;
  language?: string;
  sort?: MangaBrowseSort;
  period?: MangaBrowsePeriod;
}

export interface MangaBrowseResult {
  items: MangaSummary[];
  page: number;
  limit: number;
  total?: number;
  hasNextPage: boolean;
  notices?: string[];
}

export interface MangaRef {
  sourceId: string;
  mangaId: string;
  title?: string;
  url?: string;
}

export interface MangaSummary extends MangaRef {
  title: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  latestChapter?: string;
  tags?: string[];
}

export interface MangaDetails extends MangaSummary {
  altTitles?: string[];
  authors?: string[];
  chapters?: ChapterRef[];
}

export interface ChapterRef {
  sourceId: string;
  mangaId: string;
  chapterId: string;
  title?: string;
  chapter?: string;
  volume?: string;
  language?: string;
  url?: string;
  publishedAt?: string;
  mangaTitle?: string;
}

export interface PageAsset {
  index: number;
  url: string;
  filename?: string;
  extension?: string;
  headers?: Record<string, string>;
}

export interface ChapterAssetPlan {
  sourceId: string;
  manga: MangaRef;
  chapter: ChapterRef;
  pages: PageAsset[];
  referer?: string;
  headers?: Record<string, string>;
  expiresAt?: string;
}

export interface AuthStatus {
  sourceId: string;
  signedIn: boolean;
  message?: string;
  checkedAt: string;
}

export interface SourceDescriptor {
  id: string;
  displayName: string;
  baseUrl?: string;
  capabilities: SourceCapability[];
  health: SourceHealth;
  confidence?: number;
  needsReview?: boolean;
}

export interface SourceContext {
  fetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
  userAgent: string;
  language: string;
  signal?: AbortSignal;
  log?: (message: string, data?: unknown) => void;
}

export interface SourceAdapter {
  id: string;
  displayName: string;
  baseUrl?: string;
  capabilities: SourceCapability[];
  match(inputUrl: string): boolean;
  browse(query: MangaBrowseQuery, ctx: SourceContext): Promise<MangaBrowseResult>;
  search(query: MangaSearchQuery, ctx: SourceContext): Promise<MangaSummary[]>;
  getManga(ref: MangaRef, ctx: SourceContext): Promise<MangaDetails>;
  listChapters(ref: MangaRef, ctx: SourceContext): Promise<ChapterRef[]>;
  resolveChapter(ref: ChapterRef, ctx: SourceContext): Promise<ChapterAssetPlan>;
  authenticate?: (ctx: SourceContext) => Promise<AuthStatus>;
  health?: (ctx: SourceContext) => Promise<SourceHealth>;
}

export interface DownloadSettings {
  downloadRoot: string;
  activeChapters: number;
  activePages: number;
  requestsPerHost: number;
  retryAttempts: number;
  retryBaseDelayMs: number;
  language: string;
  writeCbz: boolean;
  overwriteExisting: boolean;
}

export interface DownloadChapterRequest {
  manga: MangaRef;
  chapter: ChapterRef;
}

export interface DownloadBatchRequest {
  sourceId: string;
  chapters: DownloadChapterRequest[];
}

export interface DownloadJob {
  id: string;
  sourceId: string;
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterTitle: string;
  chapterLabel: string;
  status: DownloadStatus;
  progressDone: number;
  progressTotal: number;
  retryCount: number;
  error?: string;
  outputDir: string;
  createdAt: string;
  updatedAt: string;
  payload: DownloadChapterRequest;
}

export interface DownloadPageRecord {
  jobId: string;
  pageIndex: number;
  url: string;
  status: PageDownloadStatus;
  filePath?: string;
  attempts: number;
  error?: string;
  updatedAt: string;
}

export interface DownloadSnapshot {
  jobs: DownloadJob[];
  pages?: DownloadPageRecord[];
}

export interface LibraryChapter {
  mangaTitle: string;
  chapterTitle: string;
  path: string;
  pages: string[];
  cbzPath?: string;
  metadataPath?: string;
}

export interface LibraryManga {
  title: string;
  path: string;
  chapters: LibraryChapter[];
}

export interface SourceManifest {
  id: string;
  displayName: string;
  baseUrl: string;
  hostnames: string[];
  enabled: boolean;
  confidence: number;
  needsReview?: boolean;
  browse?: ManifestBrowseRule;
  search?: ManifestSearchRule;
  manga?: ManifestMangaRule;
  chapters?: ManifestChapterRule;
  pages?: ManifestPageRule;
}

export interface ManifestTextSelector {
  selector: string;
  attr?: string;
  fallbackAttr?: string[];
  transform?: "trim" | "absolute-url" | "number";
}

export interface ManifestSearchRule {
  pathTemplate: string;
  itemSelector: string;
  title: ManifestTextSelector;
  url: ManifestTextSelector;
  cover?: ManifestTextSelector;
  description?: ManifestTextSelector;
}

export type ManifestBrowseSortTemplates = Partial<
  Record<MangaBrowseSort, string | Partial<Record<MangaBrowsePeriod, string>>>
>;

export interface ManifestBrowseRule extends ManifestSearchRule {
  pageStart?: number;
  sortTemplates?: ManifestBrowseSortTemplates;
}

export interface ManifestMangaRule {
  title: ManifestTextSelector;
  cover?: ManifestTextSelector;
  description?: ManifestTextSelector;
}

export interface ManifestChapterRule {
  itemSelector: string;
  title: ManifestTextSelector;
  url: ManifestTextSelector;
  chapter?: ManifestTextSelector;
  language?: ManifestTextSelector;
}

export interface ManifestPageRule {
  imageSelector: string;
  srcAttrs: string[];
  waitForSelector?: string;
}

export interface AdaptiveProbeResult {
  manifest: SourceManifest;
  sampleManga?: MangaDetails;
  sampleChapter?: ChapterAssetPlan;
  messages: string[];
}
