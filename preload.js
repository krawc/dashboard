const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dashboard', {
  // Settings
  getToken: () => ipcRenderer.invoke('settings:getToken'),
  setToken: (token) => ipcRenderer.invoke('settings:setToken', token),
  getGoogleCredentials: () => ipcRenderer.invoke('settings:getGoogleCredentials'),
  setGoogleCredentials: (clientId, clientSecret) =>
    ipcRenderer.invoke('settings:setGoogleCredentials', { clientId, clientSecret }),
  getGmailBodyCharCap: () => ipcRenderer.invoke('settings:getGmailBodyCharCap'),
  setGmailBodyCharCap: (chars) => ipcRenderer.invoke('settings:setGmailBodyCharCap', chars),
  getOllamaConfig: () => ipcRenderer.invoke('settings:getOllamaConfig'),
  setOllamaConfig: (host, model) => ipcRenderer.invoke('settings:setOllamaConfig', { host, model }),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Todoist
  getOverview: () => ipcRenderer.invoke('todoist:getOverview'),
  completeTask: (taskId) => ipcRenderer.invoke('todoist:completeTask', taskId),

  // Gmail
  listGmailAccounts: () => ipcRenderer.invoke('gmail:listAccounts'),
  addGmailAccount: () => ipcRenderer.invoke('gmail:addAccount'),
  removeGmailAccount: (email) => ipcRenderer.invoke('gmail:removeAccount', email),
  getGmailDigest: () => ipcRenderer.invoke('gmail:getDigest'),

  // Ollama
  testOllamaConnection: (host) => ipcRenderer.invoke('ollama:testConnection', host),

  // German drill
  getGermanState: () => ipcRenderer.invoke('german:getState'),
  completeGermanRound: () => ipcRenderer.invoke('german:completeRound'),

  // Pipeline logs
  getRecentLogs: () => ipcRenderer.invoke('logs:getRecent'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  onLogEntry: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on('log:entry', listener);
    return () => ipcRenderer.removeListener('log:entry', listener);
  }
});
