const store = require('./store');
const logger = require('./logger');

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:7b';
const BATCH_SIZE = 12;

const SYSTEM_PROMPT = `You are screening a personal email inbox for genuinely actionable items. Be strict — precision matters far more than recall. When in doubt, leave it out.

An email is ACTIONABLE only if at least one of these is true:

(a) It was clearly written by a real, specific individual person addressing the recipient personally — not an automated system, newsletter, marketing blast, receipt, shipping notice, or "no-reply"/"notifications@"/"team@" sender — AND it asks for or requires a personal action, decision, or reply from the recipient.

(b) It contains a concrete deadline attached to a HIGH-STAKES consequence: real, hard-to-reverse loss such as money, legal exposure, losing access to something valuable, content/app/listing removal, an account being suspended WITH data or work lost, a contractual obligation, an academic or job consequence, or a health/safety issue.

An email is NOT actionable, even if a person's name is in the "From" field or a date is mentioned, when it is:
- A newsletter, digest, marketing email, or promotional offer.
- A receipt, invoice confirmation, shipping/delivery notice, or payment confirmation with nothing left to decide.
- A routine automated notification (calendar reminder, security alert with no action needed, "your subscription renewed").
- A low-stakes deadline: e.g. "delete your account after 1 year of inactivity", a price increase notice, a generic re-engagement nudge, a countdown to a sale ending. These do NOT count as high-stakes even though they name a deadline.
- A mailing-list or bulk/CC'd message not personally addressed to the recipient.

Automated senders are NEVER actionable on sender grounds alone — only rule (b) can qualify them, and only for a genuinely high-stakes deadline (example: "your app will be removed from the store unless you respond by Friday" IS high-stakes; "your account will be deleted after a year of inactivity" is NOT).

You will be given a numbered list of emails, each with From, Subject, Date, and a body excerpt. Return ONLY a JSON array (no prose, no markdown fences) of the emails that qualify, each as:
{"id": <number from the list>, "reason": "<one short sentence citing what makes it actionable>", "deadline": "<short deadline phrase, or null>", "priority": "high" | "normal"}

Use "priority": "high" only for genuinely high-stakes or time-critical items. Return an empty array [] if nothing qualifies.`;

function getConfig() {
  return {
    host: store.get('ollamaHost', DEFAULT_HOST),
    model: store.get('ollamaModel', DEFAULT_MODEL)
  };
}

function setConfig(host, model) {
  store.set('ollamaHost', String(host || DEFAULT_HOST).trim());
  store.set('ollamaModel', String(model || DEFAULT_MODEL).trim());
}

async function testConnection(host) {
  const res = await fetch(`${host}/api/tags`);
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const body = await res.json();
  return { ok: true, models: (body.models || []).map((m) => m.name) };
}

function formatEmailForPrompt(email, index) {
  return `[${index}]
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Body: ${email.body}
---`;
}

// Extracts a JSON array from a model response that may (despite
// instructions) still wrap it in prose, a markdown fence, or — common with
// Ollama's forced JSON-object mode on smaller models — an object like
// {"actionable": [...]} instead of a bare top-level array.
function parseModelJson(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to the whole-text attempt below
    }
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const arrayValue = Object.values(parsed).find((v) => Array.isArray(v));
      if (arrayValue) return arrayValue;
    }
  } catch {
    // genuinely unparseable — caller logs this as a warning
  }

  return [];
}

async function callOllama({ host, model }, emails, batchNumber) {
  const userContent = emails.map((e, i) => formatEmailForPrompt(e, i)).join('\n');

  logger.log('ollama', `Batch ${batchNumber}: sending ${emails.length} email(s) to ${model}`, {
    model,
    emails: emails.map((e, i) => ({ index: i, from: e.from, subject: e.subject, date: e.date }))
  });

  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ]
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    logger.log('ollama', `Batch ${batchNumber}: request failed (${res.status})`, { status: res.status, body: errBody });
    throw new Error(`Ollama ${res.status}: ${errBody || res.statusText}`);
  }

  const body = await res.json();
  const content = body.message && body.message.content ? body.message.content : '';

  logger.log('ollama', `Batch ${batchNumber}: raw response`, { raw: content });

  const flagged = parseModelJson(content);

  // A trimmed response of "[]", "{}", or similar means the model
  // deliberately found nothing — that's a real result. Anything else that
  // still parsed to zero items likely means the response didn't match the
  // shape we expected, which is worth calling out rather than silently
  // treating as "nothing actionable".
  const trimmed = content.trim();
  const looksIntentionallyEmpty = /^(\[\s*\]|\{\s*\}|null)$/.test(trimmed);
  if (flagged.length === 0 && trimmed && !looksIntentionallyEmpty) {
    logger.log('ollama', `Batch ${batchNumber}: 0 items parsed from a non-empty response — check the raw response above for an unexpected shape`, {
      raw: content
    });
  } else {
    logger.log('ollama', `Batch ${batchNumber}: ${flagged.length} item(s) flagged`, { flagged });
  }

  return flagged;
}

function gmailLink(email) {
  const author = encodeURIComponent(email.account);
  return `https://mail.google.com/mail/?authuser=${author}#all/${email.threadId}`;
}

// Runs the actionability pass over every fetched email, batched to keep each
// call's context reasonable, and returns the flagged items with an "open in
// Gmail" link — sorted high-priority first.
async function extractActionableItems(emails, config) {
  const { host, model } = config || getConfig();
  const items = [];

  logger.log('ollama', `Screening ${emails.length} email(s) across ${Math.ceil(emails.length / BATCH_SIZE)} batch(es)`);

  for (let start = 0; start < emails.length; start += BATCH_SIZE) {
    const batch = emails.slice(start, start + BATCH_SIZE);
    const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
    const flagged = await callOllama({ host, model }, batch, batchNumber);

    for (const entry of flagged) {
      const email = batch[entry.id];
      if (!email) continue;
      items.push({
        id: email.id,
        account: email.account,
        from: email.from,
        subject: email.subject,
        reason: entry.reason || '',
        deadline: entry.deadline || null,
        priority: entry.priority === 'high' ? 'high' : 'normal',
        link: gmailLink(email)
      });
    }
  }

  return items.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1));
}

module.exports = {
  getConfig,
  setConfig,
  testConnection,
  extractActionableItems,
  // exported for tests
  parseModelJson,
  formatEmailForPrompt,
  DEFAULT_HOST,
  DEFAULT_MODEL
};
