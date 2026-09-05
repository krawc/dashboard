const http = require('http');
const crypto = require('crypto');
const store = require('./store');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const BODY_CHAR_CAP = 2000;
const MAX_MESSAGES_PER_ACCOUNT = 150;

// ---------------------------------------------------------------------------
// Pure helpers (no network) — kept separate so they're easy to test.
// ---------------------------------------------------------------------------

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findPart(parts, mimeType) {
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body && part.body.data) return part;
    if (part.parts) {
      const found = findPart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

// Walks a Gmail message payload (which may be a single part or a MIME tree)
// and returns the best plain-text rendering it can find.
function extractBody(payload) {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts && payload.parts.length) {
    const plain = findPart(payload.parts, 'text/plain');
    if (plain) return decodeBase64Url(plain.body.data);

    const html = findPart(payload.parts, 'text/html');
    if (html) return stripHtml(decodeBase64Url(html.body.data));
  }

  if (payload.mimeType === 'text/html' && payload.body && payload.body.data) {
    return stripHtml(decodeBase64Url(payload.body.data));
  }

  return '';
}

function parseHeaders(headers) {
  const map = {};
  for (const h of headers || []) map[h.name.toLowerCase()] = h.value;
  return map;
}

function simplifyMessage(msg, accountEmail) {
  const headers = parseHeaders(msg.payload && msg.payload.headers);
  const bodyText = extractBody(msg.payload).slice(0, BODY_CHAR_CAP);
  return {
    id: msg.id,
    account: accountEmail,
    from: headers.from || '',
    subject: headers.subject || '(no subject)',
    date: headers.date || '',
    snippet: msg.snippet || '',
    body: bodyText || msg.snippet || '',
    threadId: msg.threadId
  };
}

function buildAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Credentials & connected accounts
// ---------------------------------------------------------------------------

function getCredentials() {
  return {
    clientId: store.get('googleClientId', ''),
    clientSecret: store.get('googleClientSecret', '')
  };
}

function setCredentials(clientId, clientSecret) {
  store.set('googleClientId', String(clientId || '').trim());
  store.set('googleClientSecret', String(clientSecret || '').trim());
}

function listAccounts() {
  const accounts = store.get('gmailAccounts', {});
  return Object.keys(accounts);
}

function removeAccount(email) {
  const accounts = store.get('gmailAccounts', {});
  delete accounts[email];
  store.set('gmailAccounts', accounts);
}

// ---------------------------------------------------------------------------
// OAuth flow (loopback redirect, per Google's desktop-app pattern)
// ---------------------------------------------------------------------------

function waitForOAuthCallback(server, expectedState) {
  return new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Browsers sometimes probe the loopback server for unrelated paths
      // (e.g. /favicon.ico) — ignore anything that isn't the actual
      // redirect from Google rather than failing the whole flow on it.
      if (!code && !error) {
        res.writeHead(404);
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (error) {
        res.end('<body style="font-family:sans-serif;padding:40px">Sign-in was cancelled. You can close this tab.</body>');
        reject(new Error(`OAuth error: ${error}`));
      } else if (state !== expectedState) {
        res.end('<body style="font-family:sans-serif;padding:40px">Something went wrong. You can close this tab and try again.</body>');
        reject(new Error('OAuth callback state mismatch'));
      } else {
        res.end('<body style="font-family:sans-serif;padding:40px">Connected! You can close this tab and go back to Dashboard.</body>');
        resolve(code);
      }
    });
  });
}

async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google token exchange ${res.status}: ${body}`);
  }
  return res.json();
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google token refresh ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchProfileEmail(accessToken) {
  const res = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail profile ${res.status}: ${body || res.statusText}`);
  }
  const body = await res.json();
  return body.emailAddress;
}

// Opens the system browser for consent, catches the redirect on a local
// loopback server, exchanges the code, and persists the account's tokens.
// `openExternal` is injected so this stays testable without a real browser.
async function addAccount(openExternal) {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) {
    const err = new Error('NEED_GOOGLE_CREDENTIALS');
    err.code = 'NEED_GOOGLE_CREDENTIALS';
    throw err;
  }

  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}`;
  const state = crypto.randomBytes(16).toString('hex');

  const callbackPromise = waitForOAuthCallback(server, state);
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Sign-in timed out — no response after 5 minutes')), 5 * 60_000);
  });
  const authUrl = buildAuthUrl({ clientId, redirectUri, state });
  await openExternal(authUrl);

  let email;
  try {
    const code = await Promise.race([callbackPromise, timeoutPromise]);
    const tokens = await exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri });
    email = await fetchProfileEmail(tokens.access_token);

    const accounts = store.get('gmailAccounts', {});
    accounts[email] = {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000
    };
    store.set('gmailAccounts', accounts);
  } finally {
    clearTimeout(timeoutId);
    server.close();
  }

  return email;
}

async function ensureAccessToken(email) {
  const accounts = store.get('gmailAccounts', {});
  const account = accounts[email];
  if (!account) throw new Error(`No connected Gmail account for ${email}`);

  if (account.expiresAt > Date.now() + 30_000) {
    return account.accessToken;
  }

  const { clientId, clientSecret } = getCredentials();
  const tokens = await refreshAccessToken({ clientId, clientSecret, refreshToken: account.refreshToken });
  account.accessToken = tokens.access_token;
  account.expiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;
  accounts[email] = account;
  store.set('gmailAccounts', accounts);
  return account.accessToken;
}

// ---------------------------------------------------------------------------
// Message fetching
// ---------------------------------------------------------------------------

async function listMessageIds(accessToken, days) {
  const ids = [];
  let pageToken;

  do {
    const url = new URL(`${GMAIL_API}/users/me/messages`);
    url.searchParams.set('q', `newer_than:${days}d`);
    url.searchParams.set('maxResults', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gmail list ${res.status}: ${errBody || res.statusText}`);
    }
    const body = await res.json();

    for (const m of body.messages || []) ids.push(m.id);
    pageToken = body.nextPageToken;
  } while (pageToken && ids.length < MAX_MESSAGES_PER_ACCOUNT);

  return ids.slice(0, MAX_MESSAGES_PER_ACCOUNT);
}

async function getMessage(accessToken, id) {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail get ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

// Fetches every message from the last `days` days for one connected
// mailbox, simplified to {from, subject, date, snippet, body}.
async function fetchRecentMessages(email, days) {
  const accessToken = await ensureAccessToken(email);
  const ids = await listMessageIds(accessToken, days);

  const messages = [];
  for (const id of ids) {
    const msg = await getMessage(accessToken, id);
    messages.push(simplifyMessage(msg, email));
  }
  return messages;
}

module.exports = {
  getCredentials,
  setCredentials,
  listAccounts,
  removeAccount,
  addAccount,
  fetchRecentMessages,
  // exported for tests
  extractBody,
  stripHtml,
  parseHeaders,
  simplifyMessage,
  buildAuthUrl
};
