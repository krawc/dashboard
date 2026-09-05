/* global Chart */

const els = {
  emptyState: document.getElementById('empty-state'),
  errorState: document.getElementById('error-state'),
  errorMessage: document.getElementById('error-message'),
  grid: document.getElementById('dashboard-grid'),
  syncedAt: document.getElementById('synced-at'),

  statTotal: document.getElementById('stat-total'),
  statOverdue: document.getElementById('stat-overdue'),
  statToday: document.getElementById('stat-today'),
  statUpcoming: document.getElementById('stat-upcoming'),
  priorityBars: document.getElementById('priority-bars'),

  chartCanvas: document.getElementById('projects-chart'),
  chartCenterCount: document.getElementById('chart-center-count'),
  legend: document.getElementById('project-legend'),

  refreshBtn: document.getElementById('refresh-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  emptyConnectBtn: document.getElementById('empty-connect-btn'),
  errorRetryBtn: document.getElementById('error-retry-btn'),

  overlay: document.getElementById('settings-overlay'),
  tokenInput: document.getElementById('token-input'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsCancelBtn: document.getElementById('settings-cancel-btn'),
  todoistLink: document.getElementById('todoist-settings-link')
};

const PRIORITY_ROWS = [
  { key: 4, label: 'P1' },
  { key: 3, label: 'P2' },
  { key: 2, label: 'P3' },
  { key: 1, label: 'P4' }
];

let chart = null;

function showView(view) {
  els.emptyState.hidden = view !== 'empty';
  els.errorState.hidden = view !== 'error';
  els.grid.hidden = view !== 'data';
}

// Validated categorical palette (fixed hue order — never cycled/generated;
// see dataviz skill references/palette.md). Everything else in the app stays
// greyscale/neumorphic; this is the one place color carries meaning.
const CATEGORICAL_PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948'  // red
];
const OTHER_COLOR = '#898781'; // muted ink — recessive, reserved for "Other"

// Caps at the palette's 8 fixed slots; anything beyond that folds into a
// single "Other" bucket rather than generating a 9th hue.
function foldToPalette(projectBreakdown) {
  const max = CATEGORICAL_PALETTE.length;
  if (projectBreakdown.length <= max) return projectBreakdown;

  const kept = projectBreakdown.slice(0, max - 1);
  const rest = projectBreakdown.slice(max - 1);
  const otherCount = rest.reduce((sum, p) => sum + p.count, 0);
  return [...kept, { id: '__other__', name: 'Other', count: otherCount }];
}

function formatSyncedAt(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `synced ${time}`;
}

function renderPriorityBars(byPriority, total) {
  els.priorityBars.innerHTML = '';
  const max = Math.max(1, ...PRIORITY_ROWS.map((r) => byPriority[r.key] || 0));

  for (const row of PRIORITY_ROWS) {
    const count = byPriority[row.key] || 0;
    const pct = Math.round((count / max) * 100);

    const el = document.createElement('div');
    el.className = 'priority-row';
    el.innerHTML = `
      <span class="p-label">${row.label}</span>
      <span class="p-track"><span class="p-fill" style="width:${pct}%"></span></span>
      <span class="p-count">${count}</span>
    `;
    els.priorityBars.appendChild(el);
  }
}

function colorsFor(displayed) {
  let slot = 0;
  return displayed.map((p) => (p.id === '__other__' ? OTHER_COLOR : CATEGORICAL_PALETTE[slot++]));
}

function renderChart(displayed, totalProjectCount) {
  const labels = displayed.map((p) => p.name);
  const data = displayed.map((p) => p.count);
  const colors = colorsFor(displayed);

  els.chartCenterCount.textContent = totalProjectCount;

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
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
    els.legend.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderOverview(overview) {
  els.statTotal.textContent = overview.totalTasks;
  els.statOverdue.textContent = overview.overdue;
  els.statOverdue.closest('.stat-flag').classList.toggle('has-overdue', overview.overdue > 0);
  els.statToday.textContent = overview.dueToday;
  els.statUpcoming.textContent = overview.upcoming;

  renderPriorityBars(overview.byPriority, overview.totalTasks);
  const displayed = foldToPalette(overview.projectBreakdown);
  renderChart(displayed, overview.projectBreakdown.length);
  renderLegend(displayed);

  els.syncedAt.textContent = formatSyncedAt(overview.fetchedAt);
  showView('data');
}

async function loadOverview() {
  try {
    const overview = await window.dashboard.getOverview();
    renderOverview(overview);
  } catch (err) {
    if (err && err.message && err.message.includes('NO_TOKEN')) {
      showView('empty');
    } else {
      els.errorMessage.textContent = (err && err.message) || 'Something went wrong.';
      showView('error');
    }
  }
}

function openSettings() {
  window.dashboard.getToken().then((token) => {
    els.tokenInput.value = token || '';
    els.overlay.hidden = false;
    els.tokenInput.focus();
  });
}

function closeSettings() {
  els.overlay.hidden = true;
}

async function saveSettings() {
  const token = els.tokenInput.value.trim();
  await window.dashboard.setToken(token);
  closeSettings();
  await loadOverview();
}

els.refreshBtn.addEventListener('click', loadOverview);
els.settingsBtn.addEventListener('click', openSettings);
els.emptyConnectBtn.addEventListener('click', openSettings);
els.errorRetryBtn.addEventListener('click', loadOverview);
els.settingsSaveBtn.addEventListener('click', saveSettings);
els.settingsCancelBtn.addEventListener('click', closeSettings);

els.tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveSettings();
  if (e.key === 'Escape') closeSettings();
});

els.todoistLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.dashboard.openExternal('https://app.todoist.com/app/settings/integrations/developer');
});

loadOverview();

// Refresh automatically every 5 minutes while the app is open.
setInterval(loadOverview, 5 * 60 * 1000);
