const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const isDev = Boolean(process.env.CUBOS_RENDERER_URL);

function createWindow() {
  const win = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    title: 'CubOS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL(process.env.CUBOS_RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('cubos:get-meta', async () => {
    return {
      appName: 'CubOS',
      version: app.getVersion(),
      platform: process.platform
    };
  });

  ipcMain.handle('cubos:open-external', async (_event, url) => {
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return { ok: false };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});