const Store = require('electron-store');

// Single shared settings store for the whole app (Todoist token, Google
// OAuth client + connected mailboxes, Ollama config). Not full at-rest
// encryption, but keeps these out of a plain-text file a casual glance
// would open.
const store = new Store({
  name: 'dashboard-config',
  encryptionKey: 'dashboard-local-only'
});

module.exports = store;
