const store = require('./store');

// Todoist retired REST v2 / Sync v9 in favor of a single unified API v1,
// which paginates list endpoints as { results, next_cursor }.
const TODOIST_API = 'https://api.todoist.com/api/v1';
const MAX_PAGES = 50; // safety cap — well beyond what a personal account needs

async function todoistFetch(pathname, token, params = {}) {
  const url = new URL(`${TODOIST_API}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Todoist API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

// List endpoints on API v1 are cursor-paginated: { results: [...], next_cursor }.
// Loops until there's no next cursor, capped at MAX_PAGES as a safety net.
async function todoistFetchAll(pathname, token) {
  const items = [];
  let cursor;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await todoistFetch(pathname, token, { cursor });
    const pageItems = Array.isArray(body) ? body : body.results || [];
    items.push(...pageItems);

    const nextCursor = Array.isArray(body) ? null : body.next_cursor;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  return items;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function taskDueDate(task) {
  if (!task.due) return null;
  const raw = task.due.datetime || task.due.date;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function taskDueTimeLabel(task) {
  if (!task.due || !task.due.datetime) return null;
  const d = new Date(task.due.datetime);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function simplifyTask(task, projectName) {
  return {
    id: task.id,
    content: task.content,
    priority: task.priority,
    projectId: task.project_id,
    projectName,
    dueTime: taskDueTimeLabel(task),
    isRecurring: Boolean(task.due && task.due.is_recurring)
  };
}

// Groups tasks into the sections a morning digest actually needs — overdue,
// today, tomorrow, everything else with a date — sorted by priority (P1
// first) then by time-of-day within each day.
function buildSections(tasks, projectsById) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);

  const buckets = { overdue: [], today: [], tomorrow: [], upcoming: [] };
  let noDateCount = 0;

  for (const task of tasks) {
    const due = taskDueDate(task);
    if (!due) {
      noDateCount += 1;
      continue;
    }

    const dueDay = startOfDay(due);
    const simplified = simplifyTask(task, projectsById.get(task.project_id)?.name || 'Unknown');

    if (dueDay < today) buckets.overdue.push(simplified);
    else if (dueDay.getTime() === today.getTime()) buckets.today.push(simplified);
    else if (dueDay.getTime() === tomorrow.getTime()) buckets.tomorrow.push(simplified);
    else if (dueDay >= dayAfterTomorrow) buckets.upcoming.push(simplified);
  }

  const byPriorityThenTime = (a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
    return 0;
  };

  return {
    sections: [
      { key: 'overdue', label: 'Overdue', tasks: buckets.overdue.sort(byPriorityThenTime) },
      { key: 'today', label: 'Today', tasks: buckets.today.sort(byPriorityThenTime) },
      { key: 'tomorrow', label: 'Tomorrow', tasks: buckets.tomorrow.sort(byPriorityThenTime) },
      { key: 'upcoming', label: 'Upcoming', tasks: buckets.upcoming.sort(byPriorityThenTime) }
    ],
    noDateCount
  };
}

async function getOverview() {
  const token = store.get('todoistToken', '');
  if (!token) {
    const err = new Error('NO_TOKEN');
    err.code = 'NO_TOKEN';
    throw err;
  }

  const [tasks, projects] = await Promise.all([
    todoistFetchAll('/tasks', token),
    todoistFetchAll('/projects', token)
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const { sections, noDateCount } = buildSections(tasks, projectsById);

  const overdue = sections.find((s) => s.key === 'overdue').tasks.length;
  const dueToday = sections.find((s) => s.key === 'today').tasks.length;

  const projectCounts = new Map();
  for (const task of tasks) {
    const key = task.project_id;
    if (!projectCounts.has(key)) projectCounts.set(key, { count: 0, tasks: [] });
    const bucket = projectCounts.get(key);
    bucket.count += 1;
    bucket.tasks.push(simplifyTask(task, projectsById.get(key)?.name || 'Unknown'));
  }

  const projectBreakdown = Array.from(projectCounts.entries())
    .map(([id, { count, tasks: projectTasks }]) => ({
      id,
      name: projectsById.get(id)?.name || 'Unknown',
      count,
      tasks: projectTasks.sort(byPriorityDesc)
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalTasks: tasks.length,
    totalProjects: projects.length,
    overdue,
    dueToday,
    noDateCount,
    sections,
    projectBreakdown,
    fetchedAt: new Date().toISOString()
  };
}

function byPriorityDesc(a, b) {
  return b.priority - a.priority;
}

// Marks a task done. Todoist's close endpoint returns 204 with no body.
async function completeTask(taskId) {
  const token = store.get('todoistToken', '');
  if (!token) {
    const err = new Error('NO_TOKEN');
    err.code = 'NO_TOKEN';
    throw err;
  }

  const res = await fetch(`${TODOIST_API}/tasks/${taskId}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Todoist API ${res.status}: ${body || res.statusText}`);
  }
}

module.exports = { getOverview, buildSections, completeTask };
