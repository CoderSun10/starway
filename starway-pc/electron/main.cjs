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
const https = require('https');
const http = require('http');

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
    backgroundColor: '#eef1f6',
    show: false,
    frame: false,
    transparent: false,
    roundedCorners: false,
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

/**
 * 下载更新包到「下载」文件夹。GitHub 的下载地址会 302 到另一台机器，
 * 所以要跟着跳转。返回本地路径，进度通过 update:progress 推给渲染进程。
 */
function downloadUpdate(url, filename, hop = 0) {
  return new Promise((resolve, reject) => {
    if (hop > 5) {
      reject(new Error('跳转次数过多'));
      return;
    }
    let target;
    try {
      target = new URL(String(url));
    } catch {
      reject(new Error('下载地址无效'));
      return;
    }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      reject(new Error('不支持的下载协议'));
      return;
    }

    const safeName = String(filename || path.basename(target.pathname) || 'update')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 180);
    const dest = path.join(app.getPath('downloads'), safeName);
    const out = fs.createWriteStream(dest);

    const cleanup = () => {
      out.close(() => fs.unlink(dest, () => {}));
    };

    const mod = target.protocol === 'http:' ? http : https;
    const req = mod.get(
      target,
      { headers: { 'User-Agent': 'Starway', Accept: 'application/octet-stream' } },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          cleanup();
          downloadUpdate(res.headers.location, filename, hop + 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          cleanup();
          reject(new Error(`下载失败 HTTP ${status}`));
          return;
        }

        const total = Number(res.headers['content-length']) || 0;
        let received = 0;
        let lastSent = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          const now = Date.now();
          // 几十 MB 的包会触发上千次事件，按时间和百分比节流
          if (now - lastSent < 200 && received !== total) return;
          lastSent = now;
          mainWindow?.webContents.send('update:progress', {
            received,
            total,
            percent: total ? Math.floor((received / total) * 100) : 0,
          });
        });
        res.pipe(out);
        out.on('finish', () => {
          out.close(() => resolve({ ok: true, path: dest, name: safeName }));
        });
        out.on('error', (err) => {
          cleanup();
          reject(err);
        });
      }
    );
    req.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

function registerIpc() {
  ipcMain.handle('desktop:getInfo', () => ({
    platform: process.platform,
    version: app.getVersion(),
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

  ipcMain.handle('desktop:downloadUpdate', async (_e, payload) => {
    const { url, filename } = payload || {};
    try {
      return await downloadUpdate(url, filename);
    } catch (err) {
      return { ok: false, message: err.message || '下载失败' };
    }
  });

  ipcMain.handle('desktop:openExternal', (_e, url) => {
    const s = String(url || '');
    if (!/^https?:\/\//i.test(s)) return false;
    shell.openExternal(s);
    return true;
  });

  ipcMain.handle('desktop:showItemInFolder', (_e, target) => {
    const p = String(target || '');
    if (!p || !fs.existsSync(p)) return false;
    shell.showItemInFolder(p);
    return true;
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
