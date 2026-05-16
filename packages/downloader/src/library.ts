import { readdir } from "node:fs/promises";
import path from "node:path";
import type { LibraryChapter, LibraryManga } from "@mangadl/core";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export async function scanLibrary(root: string): Promise<LibraryManga[]> {
  const mangaDirs = await safeReadDirs(root);
  const result: LibraryManga[] = [];

  for (const mangaDir of mangaDirs) {
    const chapterDirs = await safeReadDirs(mangaDir.path);
    const chapters: LibraryChapter[] = [];

    for (const chapterDir of chapterDirs) {
      const files = await safeReadFiles(chapterDir.path);
      const pages = files
        .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()))
        .map((file) => file.path)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const cbz = files.find((file) => file.name.toLowerCase().endsWith(".cbz"));
      const metadata = files.find((file) => file.name === "chapter.json");
      if (pages.length > 0 || cbz) {
        chapters.push({
          mangaTitle: mangaDir.name,
          chapterTitle: chapterDir.name,
          path: chapterDir.path,
          pages,
          cbzPath: cbz?.path,
          metadataPath: metadata?.path
        });
      }
    }

    result.push({
      title: mangaDir.name,
      path: mangaDir.path,
      chapters: chapters.sort((a, b) => a.chapterTitle.localeCompare(b.chapterTitle, undefined, { numeric: true }))
    });
  }

  return result.sort((a, b) => a.title.localeCompare(b.title));
}

async function safeReadDirs(root: string): Promise<Array<{ name: string; path: string }>> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }));
  } catch {
    return [];
  }
}

async function safeReadFiles(root: string): Promise<Array<{ name: string; path: string }>> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }));
  } catch {
    return [];
  }
}
