export {};

declare global {
  interface Window {
    cubosDesktop?: {
      getMeta: () => Promise<{
        appName: string;
        version: string;
        platform: string;
      }>;
      openExternal: (url: string) => Promise<{ ok: boolean }>;
    };
  }
}
