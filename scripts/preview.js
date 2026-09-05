/**
 * Dev helper: renders the dashboard with mock Todoist data and saves a
 * screenshot, without needing a real API token or a visible display.
 *
 * Usage: electron scripts/preview.js [output.png]
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const mockOverview = {
  totalTasks: 42,
  totalProjects: 6,
  overdue: 3,
  dueToday: 5,
  upcoming: 21,
  noDate: 13,
  byPriority: { 4: 4, 3: 9, 2: 15, 1: 14 },
  projectBreakdown: [
    { id: '1', name: 'Dashboard App', count: 14 },
    { id: '2', name: 'NYU Research', count: 11 },
    { id: '3', name: 'Home', count: 8 },
    { id: '4', name: 'Reading List', count: 5 },
    { id: '5', name: 'Side Projects', count: 3 },
    { id: '6', name: 'Admin', count: 1 }
  ],
  fetchedAt: new Date().toISOString()
};

ipcMain.handle('settings:getToken', () => 'mock-token');
ipcMain.handle('settings:setToken', () => true);
ipcMain.handle('shell:openExternal', () => {});
ipcMain.handle('todoist:getOverview', () => mockOverview);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    // Shown (not offscreen) so Chart.js's rAF-driven draw isn't throttled.
    show: true,
    backgroundColor: '#EDEDEA',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise((r) => setTimeout(r, 1200));

  const targetPath = process.argv[2] || '/tmp/dashboard-preview.png';
  const image = await win.webContents.capturePage();
  fs.writeFileSync(targetPath, image.toPNG());
  console.log('Saved preview to', targetPath);
  app.quit();
});
