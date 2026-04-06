const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cubosDesktop', {
  getMeta: () => ipcRenderer.invoke('cubos:get-meta'),
  openExternal: (url) => ipcRenderer.invoke('cubos:open-external', url)
});