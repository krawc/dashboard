const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const store = require('./lib/store');
const todoist = require('./lib/todoist');
const gmail = require('./lib/gmail');
const gmailDigest = require('./lib/gmailDigest');
const ollama = require('./lib/ollama');
const germanDrill = require('./lib/germanDrill');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 780,
    minWidth: 760,
    minHeight: 560,
    title: 'Dashboard',
    backgroundColor: '#EDEDEA',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------

ipcMain.handle('settings:getToken', () => store.get('todoistToken', ''));

ipcMain.handle('settings:setToken', (_event, token) => {
  store.set('todoistToken', String(token || '').trim());
  return true;
});

ipcMain.handle('settings:getGoogleCredentials', () => gmail.getCredentials());

ipcMain.handle('settings:setGoogleCredentials', (_event, { clientId, clientSecret }) => {
  gmail.setCredentials(clientId, clientSecret);
  return true;
});

ipcMain.handle('settings:getOllamaConfig', () => ollama.getConfig());

ipcMain.handle('settings:setOllamaConfig', (_event, { host, model }) => {
  ollama.setConfig(host, model);
  return true;
});

ipcMain.handle('shell:openExternal', (_event, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

// ---------------------------------------------------------------------------
// Todoist
// ---------------------------------------------------------------------------

ipcMain.handle('todoist:getOverview', () => todoist.getOverview());

ipcMain.handle('todoist:completeTask', (_event, taskId) => todoist.completeTask(taskId));

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

ipcMain.handle('gmail:listAccounts', () => gmail.listAccounts());

ipcMain.handle('gmail:addAccount', () => gmail.addAccount(shell.openExternal));

ipcMain.handle('gmail:removeAccount', (_event, email) => {
  gmail.removeAccount(email);
  return true;
});

ipcMain.handle('gmail:getDigest', () => gmailDigest.getDigest());

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------

ipcMain.handle('ollama:testConnection', (_event, host) =>
  ollama.testConnection(host || ollama.getConfig().host)
);

// ---------------------------------------------------------------------------
// German drill
// ---------------------------------------------------------------------------

ipcMain.handle('german:getState', () => germanDrill.getState());

ipcMain.handle('german:completeRound', () => germanDrill.recordCompletion());
