const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashboard', {
  getToken: () => ipcRenderer.invoke('settings:getToken'),
  setToken: (token) => ipcRenderer.invoke('settings:setToken', token),
  getOverview: () => ipcRenderer.invoke('todoist:getOverview'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
});
