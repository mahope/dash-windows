import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { isMac } from './platform';

const isDev = process.argv.includes('--dev');

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Dash',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const } : {}),
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }

  return mainWindow;
}
