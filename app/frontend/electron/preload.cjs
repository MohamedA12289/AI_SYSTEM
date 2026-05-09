const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cubosDesktop', {
  getMeta: () => ipcRenderer.invoke('cubos:get-meta'),
  getBackendPort: () => ipcRenderer.invoke('cubos:get-backend-port'),
  openExternal: (url) => ipcRenderer.invoke('cubos:open-external', url),
  onBackendError: (cb) => ipcRenderer.on('cubos:backend-error', (_e, msg) => cb(msg)),
  showOpenDialog: (options) => ipcRenderer.invoke('cubos:show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('cubos:show-save-dialog', options),
  readFileBase64: (filePath) => ipcRenderer.invoke('cubos:read-file-base64', filePath),
  windowMaximize: () => ipcRenderer.invoke('cubos:window-maximize'),
  windowMinimize: () => ipcRenderer.invoke('cubos:window-minimize'),
  windowFullscreen: () => ipcRenderer.invoke('cubos:window-fullscreen'),
  windowClose: () => ipcRenderer.invoke('cubos:window-close'),
});