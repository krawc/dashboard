const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  name: 'dashboard-config',
  // Not full at-rest encryption, but keeps the token out of plain settings
  // files a casual glance would open, and off any cloud-synced dotfiles.
  encryptionKey: 'dashboard-local-only'
});

const TODOIST_API = 'https://api.todoist.com/rest/v2';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 720,
    minHeight: 520,
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
// Settings (Todoist API token)
// ---------------------------------------------------------------------------

ipcMain.handle('settings:getToken', () => {
  return store.get('todoistToken', '');
});

ipcMain.handle('settings:setToken', (_event, token) => {
  store.set('todoistToken', String(token || '').trim());
  return true;
});

ipcMain.handle('shell:openExternal', (_event, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

// ---------------------------------------------------------------------------
// Todoist data
// ---------------------------------------------------------------------------

async function todoistFetch(pathname, token) {
  const res = await fetch(`${TODOIST_API}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Todoist API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

ipcMain.handle('todoist:getOverview', async () => {
  const token = store.get('todoistToken', '');
  if (!token) {
    const err = new Error('NO_TOKEN');
    err.code = 'NO_TOKEN';
    throw err;
  }

  const [tasks, projects] = await Promise.all([
    todoistFetch('/tasks', token),
    todoistFetch('/projects', token)
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  let overdue = 0;
  let dueToday = 0;
  let noDate = 0;
  let upcoming = 0;

  const byPriority = { 1: 0, 2: 0, 3: 0, 4: 0 };

  const projectCounts = new Map();

  for (const task of tasks) {
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;

    if (task.due && task.due.date) {
      const due = new Date(task.due.date);
      if (due < startOfToday) overdue += 1;
      else if (due >= startOfToday && due < endOfToday) dueToday += 1;
      else upcoming += 1;
    } else {
      noDate += 1;
    }

    const key = task.project_id;
    projectCounts.set(key, (projectCounts.get(key) || 0) + 1);
  }

  const projectBreakdown = Array.from(projectCounts.entries())
    .map(([id, count]) => ({
      id,
      name: projectsById.get(id)?.name || 'Unknown',
      count
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalTasks: tasks.length,
    totalProjects: projects.length,
    overdue,
    dueToday,
    upcoming,
    noDate,
    byPriority,
    projectBreakdown,
    fetchedAt: new Date().toISOString()
  };
});
