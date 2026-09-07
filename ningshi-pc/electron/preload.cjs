const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ningshiDesktop', {
  getInfo: () => ipcRenderer.invoke('desktop:getInfo'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('desktop:setOpenAtLogin', enabled),
  setMinimizeToTray: (enabled) =>
    ipcRenderer.invoke('desktop:setMinimizeToTray', enabled),
  showNotification: (payload) =>
    ipcRenderer.invoke('desktop:showNotification', payload || {}),
  showWindow: () => ipcRenderer.invoke('desktop:showWindow'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  onNavigate: (cb) => {
    const handler = (_e, route) => cb(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
  platform: process.platform,
});
