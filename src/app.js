/* global Chart */

const els = {
  syncedAt: document.getElementById('synced-at'),
  refreshBtn: document.getElementById('refresh-btn'),
  settingsBtn: document.getElementById('settings-btn'),

  // Todoist card
  todoistEmpty: document.getElementById('todoist-empty'),
  todoistError: document.getElementById('todoist-error'),
  todoistErrorMessage: document.getElementById('todoist-error-message'),
  todoistContent: document.getElementById('todoist-content'),
  emptyConnectBtn: document.getElementById('empty-connect-btn'),
  todoistRetryBtn: document.getElementById('todoist-retry-btn'),

  statTotal: document.getElementById('stat-total'),
  statOverdue: document.getElementById('stat-overdue'),
  statToday: document.getElementById('stat-today'),
  statTomorrow: document.getElementById('stat-tomorrow'),
  digestSections: document.getElementById('digest-sections'),
  digestNoDate: document.getElementById('digest-nodate'),

  // Projects card
  projectsEmpty: document.getElementById('projects-empty'),
  projectsContent: document.getElementById('projects-content'),
  chartCanvas: document.getElementById('projects-chart'),
  chartCenterCount: document.getElementById('chart-center-count'),
  legend: document.getElementById('project-legend'),

  // Project modal
  projectModalOverlay: document.getElementById('project-modal-overlay'),
  projectModalTitle: document.getElementById('project-modal-title'),
  projectModalList: document.getElementById('project-modal-list'),
  projectModalClose: document.getElementById('project-modal-close'),

  // Gmail card
  gmailScanned: document.getElementById('gmail-scanned'),
  gmailEmpty: document.getElementById('gmail-empty'),
  gmailLoading: document.getElementById('gmail-loading'),
  gmailError: document.getElementById('gmail-error'),
  gmailErrorMessage: document.getElementById('gmail-error-message'),
  gmailContent: document.getElementById('gmail-content'),
  gmailList: document.getElementById('gmail-list'),
  gmailClear: document.getElementById('gmail-clear'),
  gmailConnectBtn: document.getElementById('gmail-connect-btn'),
  gmailRetryBtn: document.getElementById('gmail-retry-btn'),

  // Settings
  overlay: document.getElementById('settings-overlay'),
  tokenInput: document.getElementById('token-input'),
  todoistLink: document.getElementById('todoist-settings-link'),
  googleClientIdInput: document.getElementById('google-client-id-input'),
  googleClientSecretInput: document.getElementById('google-client-secret-input'),
  googleConsoleLink: document.getElementById('google-console-link'),
  gmailAccountList: document.getElementById('gmail-account-list'),
  gmailAddAccountBtn: document.getElementById('gmail-add-account-btn'),
  ollamaHostInput: document.getElementById('ollama-host-input'),
  ollamaModelInput: document.getElementById('ollama-model-input'),
  ollamaTestBtn: document.getElementById('ollama-test-btn'),
  ollamaTestResult: document.getElementById('ollama-test-result'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsCancelBtn: document.getElementById('settings-cancel-btn')
};

const PRIORITY_LABEL = { 4: 'P1', 3: 'P2', 2: 'P3', 1: 'P4' };
const SECTION_ROW_CAP = 6;

const CATEGORICAL_PALETTE = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948'
];
const OTHER_COLOR = '#898781';

let chart = null;
let latestOverview = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setState(container, hiddenMap) {
  for (const [el, hidden] of Object.entries(hiddenMap)) {
    container[el].hidden = hidden;
  }
}

// ---------------------------------------------------------------------------
// Todoist digest
// ---------------------------------------------------------------------------

function renderTaskRow(task, { showProject = true } = {}) {
  const priorityClass = task.priority === 4 ? 'is-p1' : task.priority === 3 ? 'is-p2' : '';
  const meta = [];
  if (showProject && task.projectName) meta.push(`<span class="digest-row-project">${escapeHtml(task.projectName)}</span>`);
  if (task.dueTime) meta.push(`<span class="digest-row-time">${escapeHtml(task.dueTime)}</span>`);

  return `
    <li class="digest-row task-list-row ${priorityClass}">
      <span class="digest-row-marker"></span>
      <span class="digest-row-content">${escapeHtml(task.content)}</span>
      ${meta.length ? `<span class="digest-row-meta">${meta.join('')}</span>` : ''}
    </li>
  `;
}

function renderDigestSection(section) {
  if (section.tasks.length === 0) {
    if (section.key === 'today') {
      return `
        <div class="digest-section">
          <p class="digest-section-label">Today</p>
          <p class="digest-empty-note">Nothing due today.</p>
        </div>
      `;
    }
    return '';
  }

  const shown = section.tasks.slice(0, SECTION_ROW_CAP);
  const remaining = section.tasks.length - shown.length;
  const labelClass = section.key === 'overdue' ? 'is-overdue' : '';

  return `
    <div class="digest-section">
      <p class="digest-section-label ${labelClass}">${section.label}</p>
      <ul class="digest-rows">
        ${shown.map((t) => renderTaskRow(t)).join('')}
      </ul>
      ${remaining > 0 ? `<p class="digest-more">+${remaining} more</p>` : ''}
    </div>
  `;
}

function renderDigest(overview) {
  els.statTotal.textContent = overview.totalTasks;
  els.statOverdue.textContent = overview.overdue;
  els.statOverdue.closest('.stat-flag').classList.toggle('has-overdue', overview.overdue > 0);
  els.statToday.textContent = overview.dueToday;

  const tomorrowSection = overview.sections.find((s) => s.key === 'tomorrow');
  els.statTomorrow.textContent = tomorrowSection ? tomorrowSection.tasks.length : 0;

  els.digestSections.innerHTML = overview.sections.map(renderDigestSection).join('');

  els.digestNoDate.hidden = overview.noDateCount === 0;
  els.digestNoDate.textContent =
    overview.noDateCount > 0
      ? `${overview.noDateCount} task${overview.noDateCount === 1 ? '' : 's'} with no date`
      : '';
}

// ---------------------------------------------------------------------------
// Projects chart
// ---------------------------------------------------------------------------

// Caps at the palette's 8 fixed slots; anything beyond that folds into a
// single "Other" bucket rather than generating a 9th hue.
function foldToPalette(projectBreakdown) {
  const max = CATEGORICAL_PALETTE.length;
  if (projectBreakdown.length <= max) return projectBreakdown;

  const kept = projectBreakdown.slice(0, max - 1);
  const rest = projectBreakdown.slice(max - 1);
  const otherCount = rest.reduce((sum, p) => sum + p.count, 0);
  const otherTasks = rest.flatMap((p) => p.tasks);
  return [...kept, { id: '__other__', name: 'Other', count: otherCount, tasks: otherTasks }];
}

function colorsFor(displayed) {
  let slot = 0;
  return displayed.map((p) => (p.id === '__other__' ? OTHER_COLOR : CATEGORICAL_PALETTE[slot++]));
}

function openProjectModal(project) {
  els.projectModalTitle.textContent = project.name;
  const sorted = [...project.tasks].sort((a, b) => b.priority - a.priority);
  els.projectModalList.innerHTML = sorted.length
    ? sorted.map((t) => renderTaskRow(t, { showProject: false })).join('')
    : '<li class="digest-empty-note">No open tasks.</li>';
  els.projectModalOverlay.hidden = false;
}

function renderChart(displayed) {
  const labels = displayed.map((p) => p.name);
  const data = displayed.map((p) => p.count);
  const colors = colorsFor(displayed);

  els.chartCenterCount.textContent = latestOverview ? latestOverview.projectBreakdown.length : displayed.length;

  const handleSliceClick = (index) => {
    const project = displayed[index];
    if (project) openProjectModal(project);
  };

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.options.onClick = (_evt, active) => {
      if (active.length) handleSliceClick(active[0].index);
    };
    chart.update();
    return;
  }

  chart = new Chart(els.chartCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: '#ECECE9',
          borderWidth: 3,
          hoverOffset: 4
        }
      ]
    },
    options: {
      cutout: '68%',
      onHover: (evt, active) => {
        evt.native.target.style.cursor = active.length ? 'pointer' : 'default';
      },
      onClick: (_evt, active) => {
        if (active.length) handleSliceClick(active[0].index);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2B2B2A',
          titleFont: { family: 'Roboto Mono' },
          bodyFont: { family: 'Roboto' },
          padding: 10,
          cornerRadius: 8
        }
      },
      animation: { duration: 300 }
    }
  });
}

function renderLegend(displayed) {
  const colors = colorsFor(displayed);
  els.legend.innerHTML = '';

  displayed.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-swatch" style="background:${colors[i]}"></span>
      <span class="legend-name">${escapeHtml(p.name)}</span>
      <span class="legend-count">${p.count}</span>
    `;
    li.addEventListener('click', () => openProjectModal(p));
    els.legend.appendChild(li);
  });
}

// ---------------------------------------------------------------------------
// Todoist load
// ---------------------------------------------------------------------------

async function loadOverview() {
  try {
    const overview = await window.dashboard.getOverview();
    latestOverview = overview;

    setState(els, { todoistEmpty: true, todoistError: true, todoistContent: false });
    setState(els, { projectsEmpty: true, projectsContent: false });

    renderDigest(overview);

    const displayed = foldToPalette(overview.projectBreakdown);
    renderChart(displayed);
    renderLegend(displayed);

    els.syncedAt.textContent = `synced ${new Date(overview.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    latestOverview = null;
    if (err && err.message && err.message.includes('NO_TOKEN')) {
      setState(els, { todoistEmpty: false, todoistError: true, todoistContent: true });
      setState(els, { projectsEmpty: false, projectsContent: true });
    } else {
      els.todoistErrorMessage.textContent = (err && err.message) || 'Something went wrong.';
      setState(els, { todoistEmpty: true, todoistError: false, todoistContent: true });
      setState(els, { projectsEmpty: false, projectsContent: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Gmail digest
// ---------------------------------------------------------------------------

function renderGmailItem(item) {
  const priorityTag = item.priority === 'high' ? '<span class="action-item-priority">High</span>' : '';
  return `
    <li class="action-item" data-link="${escapeHtml(item.link)}">
      <div class="action-item-top">
        <span class="action-item-from">${escapeHtml(item.from)}</span>
        ${priorityTag}
      </div>
      <span class="action-item-subject">${escapeHtml(item.subject)}</span>
      <span class="action-item-reason">${escapeHtml(item.reason)}</span>
      ${item.deadline ? `<span class="action-item-deadline">${escapeHtml(item.deadline)}</span>` : ''}
    </li>
  `;
}

function gmailState(view) {
  setState(els, {
    gmailEmpty: view !== 'empty',
    gmailLoading: view !== 'loading',
    gmailError: view !== 'error',
    gmailContent: view !== 'content'
  });
}

async function loadGmailDigest() {
  let accounts;
  try {
    accounts = await window.dashboard.listGmailAccounts();
  } catch {
    accounts = [];
  }

  if (!accounts || accounts.length === 0) {
    gmailState('empty');
    return;
  }

  gmailState('loading');

  try {
    const digest = await window.dashboard.getGmailDigest();
    gmailState('content');

    els.gmailScanned.textContent = `${digest.scannedCount} scanned`;
    els.gmailList.innerHTML = digest.items.map(renderGmailItem).join('');
    els.gmailClear.hidden = digest.items.length > 0;
  } catch (err) {
    gmailState('error');
    els.gmailErrorMessage.textContent = (err && err.message) || 'Something went wrong.';
  }
}

els.gmailList.addEventListener('click', (e) => {
  const item = e.target.closest('.action-item');
  if (item) window.dashboard.openExternal(item.dataset.link);
});

// ---------------------------------------------------------------------------
// Project modal
// ---------------------------------------------------------------------------

function closeProjectModal() {
  els.projectModalOverlay.hidden = true;
}

els.projectModalClose.addEventListener('click', closeProjectModal);
els.projectModalOverlay.addEventListener('click', (e) => {
  if (e.target === els.projectModalOverlay) closeProjectModal();
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function renderAccountList(accounts) {
  els.gmailAccountList.innerHTML = accounts
    .map(
      (email) => `
      <div class="account-row" data-email="${escapeHtml(email)}">
        <span class="account-row-email">${escapeHtml(email)}</span>
        <button class="account-row-remove" title="Remove" aria-label="Remove ${escapeHtml(email)}">×</button>
      </div>
    `
    )
    .join('');
}

async function refreshAccountList() {
  const accounts = await window.dashboard.listGmailAccounts();
  renderAccountList(accounts);
}

els.gmailAccountList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.account-row-remove');
  if (!btn) return;
  const email = btn.closest('.account-row').dataset.email;
  await window.dashboard.removeGmailAccount(email);
  await refreshAccountList();
});

els.gmailAddAccountBtn.addEventListener('click', async () => {
  els.gmailAddAccountBtn.textContent = 'Waiting for sign-in…';
  els.gmailAddAccountBtn.disabled = true;
  try {
    await window.dashboard.addGmailAccount();
    await refreshAccountList();
  } catch (err) {
    const message = err && err.message && err.message.includes('NEED_GOOGLE_CREDENTIALS')
      ? 'Add a Google OAuth client ID and secret above first.'
      : (err && err.message) || 'Could not connect that account.';
    window.alert(message); // eslint-disable-line no-alert
  } finally {
    els.gmailAddAccountBtn.textContent = '+ Add Gmail account';
    els.gmailAddAccountBtn.disabled = false;
  }
});

els.ollamaTestBtn.addEventListener('click', async () => {
  els.ollamaTestResult.textContent = 'Testing…';
  try {
    const result = await window.dashboard.testOllamaConnection(els.ollamaHostInput.value.trim());
    els.ollamaTestResult.textContent = result.models.length
      ? `Connected — ${result.models.length} model${result.models.length === 1 ? '' : 's'} available`
      : 'Connected — no models pulled yet';
  } catch (err) {
    els.ollamaTestResult.textContent = `Couldn't connect: ${(err && err.message) || 'unknown error'}`;
  }
});

async function openSettings() {
  const [token, googleCreds, ollamaConfig] = await Promise.all([
    window.dashboard.getToken(),
    window.dashboard.getGoogleCredentials(),
    window.dashboard.getOllamaConfig()
  ]);

  els.tokenInput.value = token || '';
  els.googleClientIdInput.value = googleCreds.clientId || '';
  els.googleClientSecretInput.value = googleCreds.clientSecret || '';
  els.ollamaHostInput.value = ollamaConfig.host || '';
  els.ollamaModelInput.value = ollamaConfig.model || '';
  els.ollamaTestResult.textContent = '';

  await refreshAccountList();

  els.overlay.hidden = false;
  els.tokenInput.focus();
}

function closeSettings() {
  els.overlay.hidden = true;
}

async function saveSettings() {
  await Promise.all([
    window.dashboard.setToken(els.tokenInput.value.trim()),
    window.dashboard.setGoogleCredentials(els.googleClientIdInput.value.trim(), els.googleClientSecretInput.value.trim()),
    window.dashboard.setOllamaConfig(els.ollamaHostInput.value.trim(), els.ollamaModelInput.value.trim())
  ]);
  closeSettings();
  await loadAll();
}

els.settingsBtn.addEventListener('click', openSettings);
els.emptyConnectBtn.addEventListener('click', openSettings);
els.gmailConnectBtn.addEventListener('click', openSettings);
els.settingsSaveBtn.addEventListener('click', saveSettings);
els.settingsCancelBtn.addEventListener('click', closeSettings);
els.overlay.addEventListener('click', (e) => {
  if (e.target === els.overlay) closeSettings();
});

els.tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettings();
});

els.todoistLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.dashboard.openExternal('https://app.todoist.com/app/settings/integrations/developer');
});

els.googleConsoleLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.dashboard.openExternal('https://console.cloud.google.com/apis/credentials');
});

els.todoistRetryBtn.addEventListener('click', loadOverview);
els.gmailRetryBtn.addEventListener('click', loadGmailDigest);

// ---------------------------------------------------------------------------
// German drill
// ---------------------------------------------------------------------------

const GERMAN_CATEGORY_META = {
  gender: { label: 'Artikel · der/die/das', options: ['der', 'die', 'das'] },
  caseFixed: { label: 'Präposition + Fall', options: ['Akkusativ', 'Dativ', 'Genitiv'] },
  wechsel: { label: 'Wechselpräposition · Wo? / Wohin?', options: ['Akkusativ', 'Dativ'] },
  verbPrep: { label: 'Verb + Präposition', options: null }
};

const germanEls = {
  streak: document.getElementById('german-streak'),
  done: document.getElementById('german-done'),
  doneSummary: document.getElementById('german-done-summary'),
  moreBtn: document.getElementById('german-more-btn'),
  active: document.getElementById('german-active'),
  progress: document.getElementById('german-progress'),
  category: document.getElementById('german-category'),
  prompt: document.getElementById('german-prompt'),
  options: document.getElementById('german-options'),
  feedback: document.getElementById('german-feedback'),
  nextBtn: document.getElementById('german-next-btn')
};

let germanRound = [];
let germanRoundIndex = 0;
let germanRoundResults = [];
// True only for the day's first round — a "practice more" bonus round
// shouldn't bump the streak a second time.
let germanCountsTowardStreak = false;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Five questions: one from each of the four focus areas, plus one more
// from a random area, so a round always touches everything you're working on.
function buildGermanRound() {
  const categories = shuffle(Object.keys(GERMAN_CATEGORY_META));
  const order = [...categories, pickRandom(categories)];
  return order.map((category) => ({ category, item: pickRandom(window.GermanDrills[category]) }));
}

function germanPrompt(category, item) {
  if (category === 'gender') return item.noun;
  if (category === 'caseFixed') return `„${item.prep}“`;
  return item.sentence;
}

function germanOptions(category, item) {
  return GERMAN_CATEGORY_META[category].options || item.options;
}

function renderGermanProgress() {
  germanEls.progress.innerHTML = germanRound
    .map((_, i) => {
      let cls = 'drill-dot';
      if (i === germanRoundIndex) cls += ' is-current';
      if (germanRoundResults[i] === true) cls += ' is-correct';
      if (germanRoundResults[i] === false) cls += ' is-wrong';
      return `<span class="${cls}"></span>`;
    })
    .join('');
}

function renderGermanQuestion() {
  const { category, item } = germanRound[germanRoundIndex];
  germanEls.category.textContent = GERMAN_CATEGORY_META[category].label;
  germanEls.prompt.textContent = germanPrompt(category, item);
  germanEls.feedback.hidden = true;
  germanEls.nextBtn.hidden = true;

  germanEls.options.innerHTML = germanOptions(category, item)
    .map((opt) => `<button class="drill-option" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`)
    .join('');

  renderGermanProgress();
}

function handleGermanAnswer(selected) {
  const { item } = germanRound[germanRoundIndex];
  const correct = selected === item.answer;
  germanRoundResults[germanRoundIndex] = correct;

  [...germanEls.options.children].forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.value === item.answer) btn.classList.add('is-correct');
    else if (btn.dataset.value === selected) btn.classList.add('is-incorrect');
  });

  germanEls.feedback.hidden = false;
  germanEls.feedback.className = correct ? 'drill-feedback is-correct-msg' : 'drill-feedback';
  germanEls.feedback.textContent = item.hint || (correct ? 'Richtig!' : `Richtig wäre: ${item.answer}`);

  germanEls.nextBtn.hidden = false;
  germanEls.nextBtn.textContent = germanRoundIndex < germanRound.length - 1 ? 'Weiter' : 'Fertig';

  renderGermanProgress();
}

function showGermanDone(state, correctCount) {
  germanEls.active.hidden = true;
  germanEls.done.hidden = false;

  if (state) germanEls.streak.textContent = state.streak > 0 ? `${state.streak} day streak` : '';

  germanEls.doneSummary.textContent = germanCountsTowardStreak
    ? `${correctCount}/5 today. See you tomorrow.`
    : `${correctCount}/5 this round.`;
}

async function finishGermanRound() {
  const correctCount = germanRoundResults.filter(Boolean).length;

  if (germanCountsTowardStreak) {
    const state = await window.dashboard.completeGermanRound();
    showGermanDone(state, correctCount);
  } else {
    showGermanDone(null, correctCount);
  }
}

function startGermanRound() {
  germanRound = buildGermanRound();
  germanRoundIndex = 0;
  germanRoundResults = [];
  germanEls.done.hidden = true;
  germanEls.active.hidden = false;
  renderGermanQuestion();
}

germanEls.options.addEventListener('click', (e) => {
  const btn = e.target.closest('.drill-option');
  if (!btn || btn.disabled) return;
  handleGermanAnswer(btn.dataset.value);
});

germanEls.nextBtn.addEventListener('click', () => {
  if (germanRoundIndex < germanRound.length - 1) {
    germanRoundIndex += 1;
    renderGermanQuestion();
  } else {
    finishGermanRound();
  }
});

germanEls.moreBtn.addEventListener('click', () => {
  germanCountsTowardStreak = false;
  startGermanRound();
});

async function loadGermanDrill() {
  const state = await window.dashboard.getGermanState();
  germanEls.streak.textContent = state.streak > 0 ? `${state.streak} day streak` : '';

  if (state.doneToday) {
    germanEls.active.hidden = true;
    germanEls.done.hidden = false;
    germanEls.doneSummary.textContent = 'Come back tomorrow for a new round.';
  } else {
    germanCountsTowardStreak = true;
    startGermanRound();
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function loadAll() {
  return Promise.all([loadOverview(), loadGmailDigest()]);
}

els.refreshBtn.addEventListener('click', loadAll);

loadAll();
// The German drill keeps its own in-page session state (current round,
// answers so far) — it's intentionally excluded from loadAll()/refresh so
// a manual refresh or the 5-minute auto-refresh never resets a round the
// user is in the middle of.
loadGermanDrill();

// Refresh automatically every 5 minutes while the app is open.
setInterval(loadAll, 5 * 60 * 1000);
