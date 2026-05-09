export {};

declare global {
  interface Window {
    cubosDesktop?: {
      getMeta: () => Promise<{
        appName: string;
        version: string;
        platform: string;
        userDataPath?: string;
        isPackaged?: boolean;
      }>;
      openExternal: (url: string) => Promise<{ ok: boolean }>;
      onBackendError?: (cb: (msg: string) => void) => void;
      showOpenDialog: (options: {
        properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate'>;
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<{
        canceled: boolean;
        filePaths: string[];
      }>;
      showSaveDialog: (options: {
        title?: string;
        defaultPath?: string;
        buttonLabel?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
    };
  }
}
