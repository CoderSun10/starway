const {
  app,
  BrowserWindow,
  shell,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;

const prefsPath = path.join(app.getPath('userData'), 'desktop-prefs.json');

function migrateUserData() {
  const destDir = app.getPath('userData');
  const destPrefs = path.join(destDir, 'desktop-prefs.json');
  if (fs.existsSync(destPrefs)) return;
  const appData = app.getPath('appData');
  for (const oldName of ['ningshi-pc', 'Ningshi']) {
    const srcPrefs = path.join(appData, oldName, 'desktop-prefs.json');
    if (!fs.existsSync(srcPrefs)) continue;
    try {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPrefs, destPrefs);
    } catch {
      // ignore
    }
    return;
  }
}

function loadPrefs() {
  // 开发模式：关窗口即退出，避免托盘残留导致下次 npm run dev 秒退
  if (isDev) return { minimizeToTray: false };
  try {
    if (fs.existsSync(prefsPath)) {
      return { minimizeToTray: true, ...JSON.parse(fs.readFileSync(prefsPath, 'utf8')) };
    }
  } catch {
    // ignore
  }
  return { minimizeToTray: true };
}

function savePrefs(partial) {
  const next = { ...loadPrefs(), ...partial };
  try {
    fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
    fs.writeFileSync(prefsPath, JSON.stringify(next, null, 2), 'utf8');
  } catch {
    // ignore
  }
  return next;
}

function iconPath(name) {
  // 优先使用与安卓 App 相同的 icon（build/ + 打包 extraResources）
  const candidates = [
    path.join(__dirname, '..', 'build', name),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'build', name),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, name),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function loadAppIcon() {
  const p = iconPath('icon.png');
  if (!p) return undefined;
  return nativeImage.createFromPath(p);
}

function loadTrayIcon() {
  const p = iconPath('tray.png') || iconPath('icon.png');
  if (!p) return nativeImage.createEmpty();
  let img = nativeImage.createFromPath(p);
  if (!img.isEmpty()) {
    img = img.resize({ width: 16, height: 16 });
  }
  return img;
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('星程');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow(),
    },
    {
      label: '开始专注',
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send('navigate', '/focus');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showMainWindow());
  tray.on('click', () => showMainWindow());
}

function emitMaximized() {
  if (!mainWindow) return;
  mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
}

function createWindow() {
  const icon = loadAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: '星程',
    backgroundColor: '#00000000',
    show: false,
    frame: false,
    transparent: true,
    roundedCorners: true,
    hasShadow: true,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('maximize', emitMaximized);
  mainWindow.on('unmaximize', emitMaximized);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    const prefs = loadPrefs();
    if (!isQuitting && prefs.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
      if (process.platform === 'win32' && Notification.isSupported()) {
        // 仅首次提示可接受；避免刷屏只在 hide 时轻提示
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('desktop:getInfo', () => ({
    platform: process.platform,
    versions: process.versions,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    minimizeToTray: loadPrefs().minimizeToTray,
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('desktop:setOpenAtLogin', (_e, enabled) => {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      path: process.execPath,
      args: app.isPackaged ? [] : [path.resolve(path.join(__dirname, '..'))],
    });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('desktop:setMinimizeToTray', (_e, enabled) => {
    const prefs = savePrefs({ minimizeToTray: !!enabled });
    return prefs.minimizeToTray;
  });

  ipcMain.handle('desktop:showNotification', (_e, { title, body }) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({
      title: title || '星程',
      body: body || '',
      icon: loadAppIcon(),
    });
    n.on('click', () => showMainWindow());
    n.show();
    return true;
  });

  ipcMain.handle('desktop:showWindow', () => {
    showMainWindow();
    return true;
  });

  ipcMain.handle('desktop:quit', () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
    return true;
  });
  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => {
    mainWindow?.close();
    return true;
  });
  ipcMain.handle('window:isMaximized', () => !!mainWindow?.isMaximized());

  ipcMain.handle('desktop:setTrayTooltip', (_e, text) => {
    if (tray) tray.setToolTip(String(text || '星程'));
    return { ok: true };
  });
}

function boot() {
  app.whenReady().then(() => {
    migrateUserData();
    registerIpc();
    createWindow();
    // 开发模式可不建托盘，避免关不干净
    if (!isDev) createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // 开发模式始终退出；生产可托盘驻留
      if (isDev || isQuitting || !loadPrefs().minimizeToTray) {
        app.quit();
      }
    }
  });
}

// 开发模式禁用单实例锁：否则第二次 npm run dev 会立刻 exit 0，并把 vite 一起杀掉
if (isDev) {
  boot();
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => showMainWindow());
    boot();
  }
}
