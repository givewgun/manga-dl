const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const COLLAPSED_WHITESPACE = /\s+/g;

export function sanitizePathSegment(input: string, fallback = "untitled"): string {
  const cleaned = input
    .replace(ILLEGAL_FILENAME_CHARS, " ")
    .replace(COLLAPSED_WHITESPACE, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  const safe = cleaned.length > 0 ? cleaned : fallback;
  const bounded = safe.slice(0, 120).trim();

  if (RESERVED_WINDOWS_NAMES.test(bounded)) {
    return `${bounded}_`;
  }

  return bounded || fallback;
}

export function chapterLabel(chapter: {
  chapter?: string;
  volume?: string;
  title?: string;
  chapterId: string;
}): string {
  const parts: string[] = [];
  if (chapter.volume) {
    parts.push(`v${chapter.volume}`);
  }
  if (chapter.chapter) {
    parts.push(`c${chapter.chapter}`);
  }
  if (chapter.title) {
    parts.push(chapter.title);
  }
  if (parts.length === 0) {
    parts.push(chapter.chapterId);
  }
  return sanitizePathSegment(parts.join(" - "), "chapter");
}

export function inferExtensionFromUrl(url: string, contentType?: string | null): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  if (contentType?.includes("avif")) return ".avif";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return ".jpg";

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpe?g|png|webp|gif|avif)$/);
    if (match?.[0]) return match[0] === ".jpeg" ? ".jpg" : match[0];
  } catch {
    // Fall through to the common default.
  }

  return ".jpg";
}

export function numberedPageFilename(index: number, extension: string): string {
  return `${String(index + 1).padStart(4, "0")}${extension.startsWith(".") ? extension : `.${extension}`}`;
}
