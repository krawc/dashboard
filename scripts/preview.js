/**
 * Dev helper: renders the dashboard with mock data (Todoist + Gmail) and
 * saves a screenshot, without needing real tokens, OAuth, or Ollama.
 *
 * Usage: electron scripts/preview.js [output.png] [--gmail-state=empty|loading|error|content]
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const gmailState = (process.argv.find((a) => a.startsWith('--gmail-state=')) || '').split('=')[1] || 'content';

function mockTask(id, content, priority, projectId, projectName, dueTime) {
  return { id, content, priority, projectId, projectName, dueTime: dueTime || null, isRecurring: false };
}

const projectTasks = {
  p1: [
    mockTask('1', 'Fix Gmail OAuth loopback edge case', 4, 'p1', 'Dashboard App', '3:00 PM'),
    mockTask('2', 'Write README setup steps', 3, 'p1', 'Dashboard App'),
    mockTask('3', 'Polish empty states', 2, 'p1', 'Dashboard App')
  ],
  p2: [
    mockTask('4', 'Draft related work section', 3, 'p2', 'NYU Research'),
    mockTask('5', 'Email advisor re: deadline', 4, 'p2', 'NYU Research', '11:00 AM')
  ],
  p3: [mockTask('6', 'Fix leaky faucet', 2, 'p3', 'Home')],
  p4: [mockTask('7', 'Finish chapter 4', 1, 'p4', 'Reading List')],
  p5: [mockTask('8', 'Side project cleanup', 2, 'p5', 'Side Projects')],
  p6: [mockTask('9', 'File expense report', 1, 'p6', 'Admin')]
};

const mockOverview = {
  totalTasks: 42,
  totalProjects: 6,
  overdue: 2,
  dueToday: 5,
  noDateCount: 8,
  sections: [
    { key: 'overdue', label: 'Overdue', tasks: [mockTask('10', 'Reply to landlord', 4, 'p3', 'Home'), mockTask('11', 'Submit grant form', 4, 'p2', 'NYU Research')] },
    {
      key: 'today',
      label: 'Today',
      tasks: [
        mockTask('1', 'Fix Gmail OAuth loopback edge case', 4, 'p1', 'Dashboard App', '3:00 PM'),
        mockTask('5', 'Email advisor re: deadline', 4, 'p2', 'NYU Research', '11:00 AM'),
        mockTask('2', 'Write README setup steps', 3, 'p1', 'Dashboard App'),
        mockTask('6', 'Fix leaky faucet', 2, 'p3', 'Home')
      ]
    },
    { key: 'tomorrow', label: 'Tomorrow', tasks: [mockTask('4', 'Draft related work section', 3, 'p2', 'NYU Research')] },
    {
      key: 'upcoming',
      label: 'Upcoming',
      tasks: [
        mockTask('7', 'Finish chapter 4', 1, 'p4', 'Reading List'),
        mockTask('8', 'Side project cleanup', 2, 'p5', 'Side Projects'),
        mockTask('9', 'File expense report', 1, 'p6', 'Admin')
      ]
    }
  ],
  projectBreakdown: [
    { id: 'p1', name: 'Dashboard App', count: 14, tasks: projectTasks.p1 },
    { id: 'p2', name: 'NYU Research', count: 11, tasks: projectTasks.p2 },
    { id: 'p3', name: 'Home', count: 8, tasks: projectTasks.p3 },
    { id: 'p4', name: 'Reading List', count: 5, tasks: projectTasks.p4 },
    { id: 'p5', name: 'Side Projects', count: 3, tasks: projectTasks.p5 },
    { id: 'p6', name: 'Admin', count: 1, tasks: projectTasks.p6 }
  ],
  fetchedAt: new Date().toISOString()
};

const mockGmailItems = [
  {
    id: 'g1',
    account: 'me@gmail.com',
    from: 'Prof. Alvarez <alvarez@nyu.edu>',
    subject: 'Re: extension on the draft',
    reason: 'A person is personally asking you to confirm a new submission date.',
    deadline: 'Reply by Thursday',
    priority: 'high',
    link: 'https://mail.google.com/mail/u/0/#all/thread1'
  },
  {
    id: 'g2',
    account: 'me@gmail.com',
    from: 'App Store Connect <no-reply@apple.com>',
    subject: 'Action required: your app will be removed',
    reason: 'High-stakes automated deadline — app removal from the store if unaddressed.',
    deadline: 'Respond within 7 days',
    priority: 'high',
    link: 'https://mail.google.com/mail/u/0/#all/thread2'
  },
  {
    id: 'g3',
    account: 'work@company.com',
    from: 'Jamie Chen <jamie@company.com>',
    subject: 'Can you review this before EOD?',
    reason: 'Personal request from a colleague requiring a reply.',
    deadline: null,
    priority: 'normal',
    link: 'https://mail.google.com/mail/u/0/#all/thread3'
  }
];

ipcMain.handle('settings:getToken', () => 'mock-token');
ipcMain.handle('settings:setToken', () => true);
ipcMain.handle('settings:getGoogleCredentials', () => ({ clientId: 'mock.apps.googleusercontent.com', clientSecret: 'mock-secret' }));
ipcMain.handle('settings:setGoogleCredentials', () => true);
ipcMain.handle('settings:getGmailBodyCharCap', () => 200);
ipcMain.handle('settings:setGmailBodyCharCap', () => true);
ipcMain.handle('settings:getOllamaConfig', () => ({ host: 'http://localhost:11434', model: 'qwen2.5:7b' }));
ipcMain.handle('settings:setOllamaConfig', () => true);
ipcMain.handle('shell:openExternal', () => {});
ipcMain.handle('todoist:getOverview', () => mockOverview);

// Mutates the mock data so completing a task actually disappears on the
// next getOverview() call, like the real Todoist-backed flow.
ipcMain.handle('todoist:completeTask', (_event, taskId) => {
  for (const section of mockOverview.sections) {
    section.tasks = section.tasks.filter((t) => t.id !== taskId);
  }
  for (const project of mockOverview.projectBreakdown) {
    const before = project.tasks.length;
    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    project.count -= before - project.tasks.length;
  }
  mockOverview.projectBreakdown = mockOverview.projectBreakdown.filter((p) => p.count > 0);
  mockOverview.totalTasks -= 1;
  mockOverview.fetchedAt = new Date().toISOString();
});

ipcMain.handle('gmail:listAccounts', () => (gmailState === 'empty' ? [] : ['me@gmail.com', 'work@company.com']));
ipcMain.handle('gmail:addAccount', () => 'me@gmail.com');
ipcMain.handle('gmail:removeAccount', () => true);
ipcMain.handle('gmail:getDigest', () => {
  if (gmailState === 'error') throw new Error('Ollama 500: model not found');
  return {
    items: gmailState === 'content-empty' ? [] : mockGmailItems,
    accounts: ['me@gmail.com', 'work@company.com'],
    scannedCount: 37,
    warnings: [],
    fetchedAt: new Date().toISOString()
  };
});

ipcMain.handle('ollama:testConnection', () => ({ ok: true, models: ['qwen2.5:7b', 'llama3.1:8b'] }));

const germanDoneToday = process.argv.includes('--german-done');
ipcMain.handle('german:getState', () => ({ streak: 4, lastCompletedDate: '2026-09-04', doneToday: germanDoneToday }));
ipcMain.handle('german:completeRound', () => ({ streak: 5, lastCompletedDate: '2026-09-05', doneToday: true }));

const mockLogs = [
  { id: 1, time: new Date(Date.now() - 60000).toISOString(), source: 'digest', message: 'Starting sync for 1 account(s): me@gmail.com', data: null },
  { id: 2, time: new Date(Date.now() - 58000).toISOString(), source: 'gmail', message: 'Fetched: "Re: extension on the draft" from Prof. Alvarez <alvarez@nyu.edu>', data: { id: 'g1', account: 'me@gmail.com', from: 'Prof. Alvarez <alvarez@nyu.edu>', subject: 'Re: extension on the draft', date: 'Mon, 1 Jan 2026', bodyExcerpt: 'Hi, could you confirm the new date...' } },
  { id: 3, time: new Date(Date.now() - 40000).toISOString(), source: 'gmail', message: 'me@gmail.com: 4 message(s) in the last 3d window (4 new, 0 cached)', data: null },
  { id: 4, time: new Date(Date.now() - 39000).toISOString(), source: 'ollama', message: 'Screening 4 email(s) across 1 batch(es)', data: null },
  { id: 5, time: new Date(Date.now() - 38000).toISOString(), source: 'ollama', message: 'Batch 1: sending 4 email(s) to qwen2.5:7b', data: { model: 'qwen2.5:7b', emails: [{ index: 0, from: 'Prof. Alvarez <alvarez@nyu.edu>', subject: 'Re: extension on the draft', date: 'Mon, 1 Jan 2026' }] } },
  { id: 6, time: new Date(Date.now() - 5000).toISOString(), source: 'ollama', message: 'Batch 1: raw response', data: { raw: '[{"id":0,"reason":"Personal request needing a reply","deadline":"Thursday","priority":"high"}]' } },
  { id: 7, time: new Date(Date.now() - 4000).toISOString(), source: 'ollama', message: 'Batch 1: 1 item(s) flagged', data: { flagged: [{ id: 0, reason: 'Personal request needing a reply', deadline: 'Thursday', priority: 'high' }] } },
  { id: 8, time: new Date(Date.now() - 3000).toISOString(), source: 'digest', message: 'Done: 1 actionable item(s) out of 4 email(s) scanned', data: null }
];
ipcMain.handle('logs:getRecent', () => mockLogs);
ipcMain.handle('logs:clear', () => true);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 900,
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

  const targetPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/dashboard-preview.png';
  const image = await win.webContents.capturePage();
  fs.writeFileSync(targetPath, image.toPNG());
  console.log('Saved preview to', targetPath);
  app.quit();
});
