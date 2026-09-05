const store = require('./store');

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// `now` is injectable so the day-rollover/streak logic is testable without
// depending on the system clock.
function getState(now = new Date()) {
  const lastCompletedDate = store.get('germanLastCompleted', '');
  const streak = store.get('germanStreak', 0);
  return { lastCompletedDate, streak, doneToday: lastCompletedDate === dateKey(now) };
}

// Marks today's daily round as complete and bumps the streak — unless
// today was already recorded, in which case it's a no-op (repeat "practice
// more" rounds don't inflate the streak).
function recordCompletion(now = new Date()) {
  const today = dateKey(now);
  const lastCompletedDate = store.get('germanLastCompleted', '');

  if (lastCompletedDate === today) {
    return getState(now);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = lastCompletedDate === dateKey(yesterday);

  const prevStreak = store.get('germanStreak', 0);
  const newStreak = wasYesterday ? prevStreak + 1 : 1;

  store.set('germanLastCompleted', today);
  store.set('germanStreak', newStreak);

  return { lastCompletedDate: today, streak: newStreak, doneToday: true };
}

module.exports = { getState, recordCompletion, dateKey };
