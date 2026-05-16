import {
  AlertTriangle,
  BookOpen,
  Check,
  Database,
  Download,
  FolderOpen,
  Globe,
  Library,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Trash2
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

type View = "search" | "downloads" | "library" | "sources" | "settings";

interface SourceDescriptor {
  id: string;
  displayName: string;
  baseUrl?: string;
  capabilities: string[];
  health: string;
  needsReview?: boolean;
}

interface MangaSummary {
  sourceId: string;
  mangaId: string;
  title: string;
  url?: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  tags?: string[];
}

type BrowseSort = "default" | "latest" | "favorites" | "rating" | "views";
type BrowsePeriod = "week" | "month" | "year" | "all";

interface MangaBrowseResult {
  items: MangaSummary[];
  page: number;
  limit: number;
  total?: number;
  hasNextPage: boolean;
  notices?: string[];
}

interface ChapterRef {
  sourceId: string;
  mangaId: string;
  chapterId: string;
  title?: string;
  chapter?: string;
  volume?: string;
  language?: string;
  url?: string;
  mangaTitle?: string;
}

interface DownloadJob {
  id: string;
  mangaTitle: string;
  chapterTitle: string;
  chapterLabel: string;
  sourceId: string;
  status: string;
  progressDone: number;
  progressTotal: number;
  retryCount: number;
  error?: string;
  outputDir: string;
}

interface LibraryManga {
  title: string;
  path: string;
  chapters: Array<{
    mangaTitle: string;
    chapterTitle: string;
    path: string;
    pages: string[];
    cbzPath?: string;
  }>;
}

interface SettingsState {
  downloadRoot: string;
  activeChapters: number;
  activePages: number;
  requestsPerHost: number;
  retryAttempts: number;
  language: string;
  writeCbz: boolean;
}

export function App() {
  if (!window.mangadl) {
    return <BridgeMissing />;
  }

  return <MangaDlApp />;
}

function MangaDlApp() {
  const [view, setView] = useState<View>("search");
  const [sources, setSources] = useState<SourceDescriptor[]>([]);
  const [health, setHealth] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<SettingsState | undefined>();
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [library, setLibrary] = useState<LibraryManga[]>([]);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    void refreshShell();
    const unsubscribe = window.mangadl.downloads.onSnapshot((snapshot) => {
      setDownloads(snapshot.jobs ?? []);
    });
    const timer = setInterval(() => {
      void window.mangadl.downloads.list().then(setDownloads);
    }, 2000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  async function refreshShell() {
    const [sourceList, appSettings, jobList, libraryList] = await Promise.all([
      window.mangadl.sources.list(),
      window.mangadl.settings.get(),
      window.mangadl.downloads.list(),
      window.mangadl.library.scan()
    ]);
    setSources(sourceList);
    setSettings(appSettings);
    setDownloads(jobList);
    setLibrary(libraryList);
    void window.mangadl.sources.health().then(setHealth).catch(() => undefined);
  }

  const activeCount = downloads.filter((job) => job.status === "running").length;
  const failedCount = downloads.filter((job) => job.status === "failed").length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Download size={18} /></div>
          <div>
            <strong>MangaDL</strong>
            <span>{activeCount} active</span>
          </div>
        </div>
        <nav className="nav-list">
          <NavButton active={view === "search"} icon={<Search size={18} />} label="Search" onClick={() => setView("search")} />
          <NavButton active={view === "downloads"} icon={<Download size={18} />} label="Downloads" badge={failedCount || undefined} onClick={() => setView("downloads")} />
          <NavButton active={view === "library"} icon={<Library size={18} />} label="Library" onClick={() => setView("library")} />
          <NavButton active={view === "sources"} icon={<Globe size={18} />} label="Sources" onClick={() => setView("sources")} />
          <NavButton active={view === "settings"} icon={<Settings size={18} />} label="Settings" onClick={() => setView("settings")} />
        </nav>
        <div className="sidebar-footer">
          <span className="muted">Root</span>
          <button className="path-button" onClick={() => settings && window.mangadl.library.openPath(settings.downloadRoot)}>
            <FolderOpen size={15} />
            <span>{settings?.downloadRoot ?? "Loading"}</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        {view === "search" && <SearchView sources={sources} settings={settings} setToast={setToast} />}
        {view === "downloads" && <DownloadsView jobs={downloads} refresh={() => window.mangadl.downloads.list().then(setDownloads)} />}
        {view === "library" && <LibraryView library={library} refresh={() => window.mangadl.library.scan().then(setLibrary)} />}
        {view === "sources" && <SourcesView sources={sources} health={health} refresh={refreshShell} setToast={setToast} />}
        {view === "settings" && settings && <SettingsView settings={settings} onUpdate={(next) => { setSettings(next); void refreshShell(); }} />}
      </main>

      {toast && (
        <button className="toast" onClick={() => setToast("")}>
          <Check size={16} />
          <span>{toast}</span>
        </button>
      )}
    </div>
  );
}

function BridgeMissing() {
  return (
    <main className="bridge-missing">
      <div>
        <Download size={34} />
        <h1>MangaDL needs the desktop shell</h1>
        <p>Start it with <code>npm run dev</code> or <code>npm run start -w @mangadl/desktop</code>. Opening the Vite URL directly in a normal browser cannot access downloads, SQLite, or source sessions.</p>
      </div>
    </main>
  );
}

function SearchView({
  sources,
  settings,
  setToast
}: {
  sources: SourceDescriptor[];
  settings?: SettingsState;
  setToast: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [sort, setSort] = useState<BrowseSort>("latest");
  const [period, setPeriod] = useState<BrowsePeriod>("week");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<MangaSummary[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [selected, setSelected] = useState<MangaSummary | undefined>();
  const [chapters, setChapters] = useState<ChapterRef[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const browseSources = useMemo(
    () => sources.filter((source) => source.capabilities.includes("browse")),
    [sources]
  );
  const catalogSources = useMemo(
    () => sources.filter((source) => source.capabilities.includes("browse") || source.capabilities.includes("search")),
    [sources]
  );
  const isBrowseMode = query.trim().length === 0;

  useEffect(() => {
    if (sourceIds.length === 0 && browseSources.length > 0) {
      setSourceIds(browseSources.map((source) => source.id));
    }
  }, [browseSources, sourceIds.length]);

  useEffect(() => {
    if (isBrowseMode && sourceIds.length > 0) {
      void runBrowse(page);
    }
  }, [isBrowseMode, sourceIds, sort, period, page, settings?.language]);

  async function runBrowse(targetPage = 1) {
    if (sourceIds.length === 0) return;
    setLoading(true);
    try {
      const browse: MangaBrowseResult = await window.mangadl.manga.browse({
        sourceIds,
        language: settings?.language ?? "en",
        limit: 36,
        page: targetPage,
        sort,
        period
      });
      setResults(browse.items);
      setHasNextPage(browse.hasNextPage);
      setNotices(browse.notices ?? []);
      setPage(browse.page);
      clearDetail();
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    if (!query.trim()) {
      await runBrowse(1);
      return;
    }
    setLoading(true);
    try {
      setResults(await window.mangadl.manga.search({
        title: query.trim(),
        sourceIds,
        language: settings?.language ?? "en",
        limit: 36
      }));
      setHasNextPage(false);
      setNotices([]);
      clearDetail();
    } finally {
      setLoading(false);
    }
  }

  async function openManga(manga: MangaSummary) {
    setSelected(manga);
    setPreview([]);
    setChecked(new Set());
    const details = await window.mangadl.manga.get(manga);
    setSelected(details);
    setChapters(details.chapters ?? []);
  }

  async function previewChapter(chapter: ChapterRef) {
    const plan = await window.mangadl.manga.preview(chapter);
    setPreview((plan.pages ?? []).slice(0, 8).map((page: { url: string }) => page.url));
  }

  async function queueSelected() {
    if (!selected) return;
    const chosen = chapters.filter((chapter) => checked.has(chapter.chapterId));
    await window.mangadl.downloads.add(
      chosen.map((chapter) => ({
        manga: selected,
        chapter: { ...chapter, mangaTitle: selected.title }
      }))
    );
    setToast(`Queued ${chosen.length} chapter${chosen.length === 1 ? "" : "s"}`);
  }

  function toggleSource(id: string) {
    setPage(1);
    setSourceIds((current) => {
      const next = current.includes(id) ? current.filter((sourceId) => sourceId !== id) : [...current, id];
      return next;
    });
  }

  function clearDetail() {
    setSelected(undefined);
    setChapters([]);
    setChecked(new Set());
    setPreview([]);
  }

  return (
    <section className="view-grid search-grid">
      <div className="panel search-panel">
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!event.target.value.trim()) setPage(1);
              }}
              onKeyDown={(event) => event.key === "Enter" && void runSearch()}
              placeholder="Search title or leave empty to browse"
            />
          </div>
          <button className="primary" onClick={() => void runSearch()} disabled={loading}>
            <Search size={16} />
            <span>{loading ? "Loading" : query.trim() ? "Search" : "Browse"}</span>
          </button>
        </div>
        <div className="browse-controls">
          <label>
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as BrowseSort);
                setPage(1);
              }}
              disabled={!isBrowseMode}
            >
              <option value="latest">Latest</option>
              <option value="favorites">Favorites</option>
              <option value="rating">Rating</option>
              <option value="views">Views</option>
              <option value="default">Site default</option>
            </select>
          </label>
          <label>
            <span>Period</span>
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as BrowsePeriod);
                setPage(1);
              }}
              disabled={!isBrowseMode || sort !== "views"}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
        <div className="source-chips">
          {catalogSources.map((source) => (
            <button key={source.id} className={sourceIds.includes(source.id) ? "chip active" : "chip"} onClick={() => toggleSource(source.id)}>
              {source.displayName}
            </button>
          ))}
        </div>
        {notices.length > 0 && isBrowseMode && (
          <div className="notice-stack">
            {notices.map((notice) => <span key={notice}>{notice}</span>)}
          </div>
        )}
        <div className="result-list">
          {results.length > 0 ? (
            results.map((manga) => (
              <button key={`${manga.sourceId}:${manga.mangaId}:${manga.url ?? ""}`} className={selected?.mangaId === manga.mangaId ? "result active" : "result"} onClick={() => void openManga(manga)}>
                {manga.coverUrl ? <img src={manga.coverUrl} alt="" /> : <div className="cover-fallback"><BookOpen size={18} /></div>}
                <span>
                  <strong>{manga.title}</strong>
                  <small>{sourceLabel(sources, manga.sourceId)} {manga.status ? `- ${manga.status}` : ""}</small>
                </span>
              </button>
            ))
          ) : (
            <EmptyState icon={<BookOpen size={30} />} title={loading ? "Loading catalog" : "No titles loaded"} />
          )}
        </div>
        {isBrowseMode && (
          <div className="pager">
            <button className="secondary" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Prev
            </button>
            <span>Page {page}</span>
            <button className="secondary" disabled={loading || !hasNextPage} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        )}
      </div>

      <div className="panel detail-panel">
        {selected ? (
          <>
            <div className="detail-head">
              {selected.coverUrl ? <img src={selected.coverUrl} alt="" /> : <div className="cover-fallback large"><BookOpen size={28} /></div>}
              <div>
                <h1>{selected.title}</h1>
                <p>{selected.description?.slice(0, 420)}</p>
                <div className="meta-row">
                  <span>{sourceLabel(sources, selected.sourceId)}</span>
                  <span>{chapters.length} chapters</span>
                  <span>{checked.size} selected</span>
                </div>
              </div>
            </div>
            <div className="action-row">
              <button className="secondary" onClick={() => setChecked(new Set(chapters.map((chapter) => chapter.chapterId)))}>
                <Check size={16} />
                <span>All</span>
              </button>
              <button className="secondary" onClick={() => setChecked(new Set(chapters.slice(-10).map((chapter) => chapter.chapterId)))}>
                <Download size={16} />
                <span>Latest 10</span>
              </button>
              <button className="primary" disabled={checked.size === 0} onClick={() => void queueSelected()}>
                <Plus size={16} />
                <span>Queue</span>
              </button>
            </div>
            <div className="chapter-table">
              {chapters.map((chapter) => (
                <div className="chapter-row" key={chapter.chapterId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked.has(chapter.chapterId)}
                      onChange={() =>
                        setChecked((current) => {
                          const next = new Set(current);
                          if (next.has(chapter.chapterId)) {
                            next.delete(chapter.chapterId);
                          } else {
                            next.add(chapter.chapterId);
                          }
                          return next;
                        })
                      }
                    />
                    <span>{chapter.chapter ? `Ch. ${chapter.chapter}` : "Chapter"} {chapter.title ? `- ${chapter.title}` : ""}</span>
                  </label>
                  <button className="icon-button" title="Preview" onClick={() => void previewChapter(chapter)}>
                    <BookOpen size={16} />
                  </button>
                </div>
              ))}
            </div>
            {preview.length > 0 && (
              <div className="preview-strip">
                {preview.map((url) => <img key={url} src={url} alt="" />)}
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={<Search size={30} />} title="Search a title" />
        )}
      </div>
    </section>
  );
}

function DownloadsView({ jobs, refresh }: { jobs: DownloadJob[]; refresh: () => Promise<unknown> }) {
  const grouped = useMemo(() => groupBy(jobs, (job) => job.mangaTitle), [jobs]);
  return (
    <section className="panel fill">
      <div className="view-head">
        <div>
          <h1>Downloads</h1>
          <p>{jobs.length} jobs - {jobs.filter((job) => job.status === "running").length} running</p>
        </div>
        <div className="action-row">
          <button className="secondary" onClick={() => void window.mangadl.downloads.pause().then(refresh)}>
            <Pause size={16} />
            <span>Pause</span>
          </button>
          <button className="primary" onClick={() => void window.mangadl.downloads.resume().then(refresh)}>
            <Play size={16} />
            <span>Resume</span>
          </button>
        </div>
      </div>
      <div className="download-groups">
        {[...grouped.entries()].map(([manga, mangaJobs]) => (
          <section className="download-group" key={manga}>
            <h2>{manga}</h2>
            {mangaJobs.map((job) => (
              <div className="job-row" key={job.id}>
                <div className="job-main">
                  <strong>{job.chapterLabel}</strong>
                  <span>{job.sourceId} - {job.status} - retries {job.retryCount}</span>
                  <div className="progress"><span style={{ width: `${progress(job)}%` }} /></div>
                  {job.error && <small className="error-text">{job.error}</small>}
                </div>
                <div className="job-actions">
                  {job.status === "failed" && <button className="icon-button" title="Retry" onClick={() => void window.mangadl.downloads.retry(job.id).then(refresh)}><RotateCcw size={16} /></button>}
                  <button className="icon-button danger" title="Cancel" onClick={() => void window.mangadl.downloads.cancel(job.id).then(refresh)}><Trash2 size={16} /></button>
                  <button className="icon-button" title="Open folder" onClick={() => void window.mangadl.library.openPath(job.outputDir)}><FolderOpen size={16} /></button>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function LibraryView({ library, refresh }: { library: LibraryManga[]; refresh: () => Promise<unknown> }) {
  return (
    <section className="panel fill">
      <div className="view-head">
        <div>
          <h1>Library</h1>
          <p>{library.length} manga</p>
        </div>
        <button className="secondary" onClick={() => void refresh()}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>
      <div className="library-grid">
        {library.map((manga) => (
          <article className="library-item" key={manga.path}>
            <div>
              <h2>{manga.title}</h2>
              <span>{manga.chapters.length} chapters</span>
            </div>
            <button className="icon-button" title="Open folder" onClick={() => void window.mangadl.library.openPath(manga.path)}>
              <FolderOpen size={16} />
            </button>
            <div className="chapter-stack">
              {manga.chapters.slice(0, 8).map((chapter) => (
                <div className="mini-row" key={chapter.path}>
                  <span>{chapter.chapterTitle}</span>
                  <button className="icon-button" title="Regenerate CBZ" onClick={() => void window.mangadl.library.regenerateCbz(chapter.path, chapter.pages).then(refresh)}>
                    <Database size={15} />
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourcesView({
  sources,
  health,
  refresh,
  setToast
}: {
  sources: SourceDescriptor[];
  health: Record<string, string>;
  refresh: () => Promise<void>;
  setToast: (value: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [probing, setProbing] = useState(false);

  async function probe() {
    if (!url.trim()) return;
    setProbing(true);
    const result = await window.mangadl.sources.probe(url.trim());
    setToast(`Added ${result.manifest.displayName}`);
    setUrl("");
    setProbing(false);
    await refresh();
  }

  return (
    <section className="panel fill">
      <div className="view-head">
        <div>
          <h1>Sources</h1>
          <p>{sources.length} configured</p>
        </div>
        <button className="secondary" onClick={() => void refresh()}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>
      <div className="toolbar">
        <div className="search-box">
          <Globe size={18} />
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://site.example/manga/title" />
        </div>
        <button className="primary" disabled={probing} onClick={() => void probe()}>
          <Plus size={16} />
          <span>{probing ? "Probing" : "Add"}</span>
        </button>
      </div>
      <div className="source-grid">
        {sources.map((source) => (
          <article className="source-item" key={source.id}>
            <div>
              <h2>{source.displayName}</h2>
              <span>{source.baseUrl ?? source.id}</span>
            </div>
            <StatusBadge status={health[source.id] ?? source.health} needsReview={source.needsReview} />
            <div className="cap-row">
              {source.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
            </div>
            <button className="secondary" onClick={() => void window.mangadl.sources.signIn(source.id).then(() => setToast("Session saved"))}>
              <Shield size={16} />
              <span>Sign in</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ settings, onUpdate }: { settings: SettingsState; onUpdate: (settings: SettingsState) => void }) {
  const [draft, setDraft] = useState(settings);

  async function save() {
    onUpdate(await window.mangadl.settings.update(draft));
  }

  return (
    <section className="panel fill settings-view">
      <div className="view-head">
        <div>
          <h1>Settings</h1>
          <p>{draft.downloadRoot}</p>
        </div>
        <button className="primary" onClick={() => void save()}>
          <Check size={16} />
          <span>Save</span>
        </button>
      </div>
      <label className="field wide">
        <span>Download root</span>
        <input value={draft.downloadRoot} onChange={(event) => setDraft({ ...draft, downloadRoot: event.target.value })} />
      </label>
      <div className="settings-grid">
        <NumberField label="Active chapters" value={draft.activeChapters} onChange={(activeChapters) => setDraft({ ...draft, activeChapters })} />
        <NumberField label="Active pages" value={draft.activePages} onChange={(activePages) => setDraft({ ...draft, activePages })} />
        <NumberField label="Requests per host" value={draft.requestsPerHost} onChange={(requestsPerHost) => setDraft({ ...draft, requestsPerHost })} />
        <NumberField label="Retry attempts" value={draft.retryAttempts} onChange={(retryAttempts) => setDraft({ ...draft, retryAttempts })} />
        <label className="field">
          <span>Language</span>
          <input value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={draft.writeCbz} onChange={(event) => setDraft({ ...draft, writeCbz: event.target.checked })} />
          <span>Write CBZ</span>
        </label>
      </div>
    </section>
  );
}

function NavButton({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {badge ? <em>{badge}</em> : null}
    </button>
  );
}

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
    </div>
  );
}

function StatusBadge({ status, needsReview }: { status: string; needsReview?: boolean }) {
  return (
    <span className={`status ${status}`}>
      {needsReview ? <AlertTriangle size={14} /> : <Check size={14} />}
      {needsReview ? "review" : status}
    </span>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function progress(job: DownloadJob): number {
  if (job.progressTotal <= 0) return job.status === "completed" ? 100 : 0;
  return Math.round((job.progressDone / job.progressTotal) * 100);
}

function sourceLabel(sources: SourceDescriptor[], id: string): string {
  return sources.find((source) => source.id === id)?.displayName ?? id;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    map.set(value, [...(map.get(value) ?? []), item]);
  }
  return map;
}
