const gmail = require('./gmail');
const ollama = require('./ollama');
const logger = require('./logger');

const DAYS = 3;

// Guards against overlapping digest runs — e.g. the 5-minute auto-refresh
// firing while a manual refresh (or a slow Ollama pass) is still in
// flight. Without this, each overlapping call re-fetches every message
// independently, which is exactly what burns through Gmail's per-minute
// quota. Concurrent callers just await the one run already in progress.
let inFlight = null;

function getDigest() {
  if (!inFlight) {
    inFlight = runDigest().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// Fetches the last few days of mail across every connected mailbox, runs it
// through the local Ollama model to flag genuinely actionable items, and
// returns a single merged digest. Per-account fetch failures are collected
// as warnings rather than failing the whole digest — one broken mailbox
// shouldn't hide the others.
async function runDigest() {
  const accounts = gmail.listAccounts();
  if (accounts.length === 0) {
    const err = new Error('NO_GMAIL_ACCOUNTS');
    err.code = 'NO_GMAIL_ACCOUNTS';
    throw err;
  }

  logger.log('digest', `Starting sync for ${accounts.length} account(s): ${accounts.join(', ')}`);

  const allMessages = [];
  const warnings = [];

  for (const email of accounts) {
    try {
      const messages = await gmail.fetchRecentMessages(email, DAYS);
      allMessages.push(...messages);
    } catch (err) {
      warnings.push(`${email}: ${err.message}`);
      logger.log('gmail', `${email}: fetch failed — ${err.message}`);
    }
  }

  if (allMessages.length === 0 && warnings.length > 0) {
    logger.log('digest', `Sync failed for every account: ${warnings.join('; ')}`);
    throw new Error(warnings.join('; '));
  }

  const items = await ollama.extractActionableItems(allMessages, ollama.getConfig());

  logger.log('digest', `Done: ${items.length} actionable item(s) out of ${allMessages.length} email(s) scanned`);

  return {
    items,
    accounts,
    scannedCount: allMessages.length,
    warnings,
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { getDigest };
