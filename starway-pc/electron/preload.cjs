const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('starwayDesktop', {
  getInfo: () => ipcRenderer.invoke('desktop:getInfo'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('desktop:setOpenAtLogin', enabled),
  setMinimizeToTray: (enabled) =>
    ipcRenderer.invoke('desktop:setMinimizeToTray', enabled),
  showNotification: (payload) =>
    ipcRenderer.invoke('desktop:showNotification', payload || {}),
  showWindow: () => ipcRenderer.invoke('desktop:showWindow'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  setTrayTooltip: (text) => ipcRenderer.invoke('desktop:setTrayTooltip', text),
  downloadUpdate: (payload) =>
    ipcRenderer.invoke('desktop:downloadUpdate', payload || {}),
  onUpdateProgress: (cb) => {
    const handler = (_e, value) => cb(value || {});
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
  openExternal: (url) => ipcRenderer.invoke('desktop:openExternal', url),
  showItemInFolder: (target) =>
    ipcRenderer.invoke('desktop:showItemInFolder', target),
  onNavigate: (cb) => {
    const handler = (_e, route) => cb(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (cb) => {
    const handler = (_e, value) => cb(!!value);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
});
