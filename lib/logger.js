const { EventEmitter } = require('events');

// A small in-memory log for the Gmail → Ollama pipeline, so what actually
// happened on a sync is visible from inside the app instead of a terminal
// that isn't there when the app is launched as a packaged .app.
const MAX_ENTRIES = 800;
const emitter = new EventEmitter();
let entries = [];
let nextId = 1;

function log(source, message, data) {
  const entry = {
    id: nextId++,
    time: new Date().toISOString(),
    source, // 'gmail' | 'ollama' | 'digest'
    message,
    data: data === undefined ? null : data
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  emitter.emit('entry', entry);
  return entry;
}

function getRecent() {
  return entries;
}

function clear() {
  entries = [];
}

function onEntry(fn) {
  emitter.on('entry', fn);
}

module.exports = { log, getRecent, clear, onEntry };
