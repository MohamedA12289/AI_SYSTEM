const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const net = require('net');

const isDev = Boolean(process.env.CUBOS_RENDERER_URL);

// Per-user writable data directory for packaged app
const userDataPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'CubOS'
);

let backendProcess = null;
let mainWindow = null;
let backendPort = null;

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort = 8000, maxAttempts = 100) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const isAvailable = await checkPortAvailable(port);
    if (isAvailable) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts}`);
}

function getBackendExePath() {
  if (isDev) return null;
  // electron-builder copies extraResources next to the app's resources folder
  return path.join(process.resourcesPath, 'cubos_backend', 'cubos_backend.exe');
}

async function startBackend() {
  const exePath = getBackendExePath();
  if (!exePath) return; // dev mode — backend started separately

  try {
    backendPort = await findAvailablePort();
  } catch (err) {
    console.error('[CubOS] Could not find available port:', err.message);
    return;
  }

  const env = Object.assign({}, process.env, {
    CUBOS_BASE_PATH: userDataPath,
    CUBOS_API_PORT: String(backendPort),
  });

  try {
    backendProcess = spawn(exePath, [], {
      env,
      detached: false,
      windowsHide: true,
      stdio: 'ignore',
    });

    backendProcess.on('error', (err) => {
      console.error('[CubOS] Backend failed to start:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cubos:backend-error', err.message);
      }
    });

    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn('[CubOS] Backend exited with code', code);
      }
      backendProcess = null;
    });
  } catch (err) {
    console.error('[CubOS] Could not spawn backend:', err.message);
  }
}

function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch {}
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
      sandbox: false,
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.CUBOS_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  ipcMain.handle('cubos:get-meta', async () => ({
    appName: 'CubOS',
    version: app.getVersion(),
    platform: process.platform,
    userDataPath,
    isPackaged: !isDev,
  }));

  ipcMain.handle('cubos:get-backend-port', async () => ({
    port: backendPort,
    ok: backendPort !== null,
  }));

  ipcMain.handle('cubos:open-external', async (_event, url) => {
    if (typeof url !== 'string' || !url.startsWith('http')) return { ok: false };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('cubos:show-open-dialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('cubos:show-save-dialog', async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('cubos:window-maximize', async () => {
    if (!mainWindow) return { ok: false };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { ok: true };
  });

  ipcMain.handle('cubos:window-minimize', async () => {
    if (!mainWindow) return { ok: false };
    mainWindow.minimize();
    return { ok: true };
  });

  ipcMain.handle('cubos:window-fullscreen', async () => {
    if (!mainWindow) return { ok: false };
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return { ok: true, fullscreen: !isFullScreen };
  });

  ipcMain.handle('cubos:window-close', async () => {
    if (!mainWindow) return { ok: false };
    mainWindow.close();
    return { ok: true };
  });

  ipcMain.handle('cubos:read-file-base64', async (_event, filePath) => {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(filePath);
      return { ok: true, data: data.toString('base64') };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  await startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});