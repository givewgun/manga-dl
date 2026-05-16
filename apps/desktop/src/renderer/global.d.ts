declare global {
  interface Window {
    mangadl: {
      settings: {
        get: () => Promise<any>;
        update: (patch: any) => Promise<any>;
      };
      sources: {
        list: () => Promise<any[]>;
        health: () => Promise<Record<string, string>>;
        signIn: (sourceId: string) => Promise<any>;
        probe: (url: string) => Promise<any>;
      };
      manga: {
        browse: (query: any) => Promise<any>;
        search: (query: any) => Promise<any[]>;
        get: (ref: any) => Promise<any>;
        chapters: (ref: any) => Promise<any[]>;
        preview: (chapter: any) => Promise<any>;
      };
      downloads: {
        add: (requests: any[]) => Promise<any[]>;
        list: () => Promise<any[]>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        cancel: (jobId: string) => Promise<void>;
        retry: (jobId: string) => Promise<void>;
        onSnapshot: (callback: (snapshot: any) => void) => () => void;
      };
      library: {
        scan: () => Promise<any[]>;
        regenerateCbz: (chapterDir: string, pages: string[]) => Promise<boolean>;
        openPath: (targetPath: string) => Promise<string>;
      };
    };
  }
}

export {};
