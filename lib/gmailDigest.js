const gmail = require('./gmail');
const ollama = require('./ollama');

const DAYS = 3;

// Fetches the last few days of mail across every connected mailbox, runs it
// through the local Ollama model to flag genuinely actionable items, and
// returns a single merged digest. Per-account fetch failures are collected
// as warnings rather than failing the whole digest — one broken mailbox
// shouldn't hide the others.
async function getDigest() {
  const accounts = gmail.listAccounts();
  if (accounts.length === 0) {
    const err = new Error('NO_GMAIL_ACCOUNTS');
    err.code = 'NO_GMAIL_ACCOUNTS';
    throw err;
  }

  const allMessages = [];
  const warnings = [];

  for (const email of accounts) {
    try {
      const messages = await gmail.fetchRecentMessages(email, DAYS);
      allMessages.push(...messages);
    } catch (err) {
      warnings.push(`${email}: ${err.message}`);
    }
  }

  if (allMessages.length === 0 && warnings.length > 0) {
    throw new Error(warnings.join('; '));
  }

  const items = await ollama.extractActionableItems(allMessages, ollama.getConfig());

  return {
    items,
    accounts,
    scannedCount: allMessages.length,
    warnings,
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { getDigest };
