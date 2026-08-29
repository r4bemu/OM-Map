import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let serverPort = 8080;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(startPort, '127.0.0.1', () => {
      const port = (s.address() as any).port;
      s.close(() => resolve(port));
    });
    s.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

async function startInternalServer(): Promise<number> {
  if (isDev) return 8080;
  const port = await findAvailablePort(8080);
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'production';
  process.env.USER_DATA_DIR = path.join(app.getPath('userData'), 'data');
  try {
    const serverPath = path.join(__dirname, '../server.cjs');
    require(serverPath);
    console.log('Internal Express server running on port:', port);
  } catch (err) {
    console.error('Failed to start internal server:', err);
  }
  return port;
}

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'NIA O&M Map & Report System',
    icon: path.join(__dirname, '../../public/nia-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });

  const startUrl = isDev ? 'http://localhost:8080' : 'http://127.0.0.1:' + port;
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('update-status', { status: 'downloading', percent: progressObj.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-status', { status: 'error', error: err.message });
  });

  ipcMain.handle('check-for-updates', () => {
    if (!isDev) return autoUpdater.checkForUpdates();
    return null;
  });

  ipcMain.handle('quit-and-install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    serverPort = await startInternalServer();
    createWindow(serverPort);
    setupAutoUpdater();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}