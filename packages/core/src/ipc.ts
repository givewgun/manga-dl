export const IPC = {
  settingsGet: "settings:get",
  settingsUpdate: "settings:update",
  sourcesList: "sources:list",
  sourcesHealth: "sources:health",
  sourcesSignin: "sources:signin",
  sourcesProbe: "sources:probe",
  browse: "manga:browse",
  search: "manga:search",
  mangaGet: "manga:get",
  chaptersList: "chapters:list",
  chapterPreview: "chapter:preview",
  downloadsAdd: "downloads:add",
  downloadsList: "downloads:list",
  downloadsPause: "downloads:pause",
  downloadsResume: "downloads:resume",
  downloadsCancel: "downloads:cancel",
  downloadsRetry: "downloads:retry",
  downloadsEvent: "downloads:event",
  libraryScan: "library:scan",
  libraryRegenerateCbz: "library:regenerate-cbz"
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
