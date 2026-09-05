# Dashboard

A minimalist, greyscale personal dashboard for macOS, built with Electron.

Currently shows:
- **Task summary** — a morning-digest style list of Todoist tasks grouped
  into Overdue / Today / Tomorrow / Upcoming, with priority and due time.
  Click a task's checkbox to mark it done right from the dashboard.
- **Projects** — a donut chart of open tasks per project, in a categorical
  color palette. Click a slice (or a legend row) to see that project's
  open tasks in a modal.
- **Needs a reply** — actionable items extracted from the last 3 days of
  Gmail across every connected mailbox, screened locally by an Ollama
  model against a strict "is this actually actionable" bar.
- **Deutsch** — a daily B2 German drill: five questions a day covering
  der/die/das, fixed-case prepositions, Wechselpräpositionen (Akkusativ
  vs. Dativ), and verbs with fixed prepositions, with a day-streak.

Designed to be airy and neumorphic: soft off-white surfaces, subtle extruded
shadows, Roboto Mono for titles/labels/numbers, Roboto for body text.

## Setup

```bash
npm install
npm start
```

Click the gear icon to open Settings and configure the integrations you
want (each is independent — the app works fine with only Todoist
connected, for example).

### Todoist

Paste your API token (Todoist → Settings → Integrations → Developer — the
app links there directly). Stored locally via `electron-store`; only ever
sent to the Todoist API.

### Gmail

Gmail access uses Google OAuth. Since this is a personal app (not a
published/verified one), you create your own OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   and create a project if you don't have one.
2. Under **APIs & Services → Library**, enable the **Gmail API**. Do this
   *before* the steps below — the consent screen's scope picker only
   offers scopes for APIs you've already enabled.
3. **OAuth consent screen**: set it to **External**, add yourself as a
   test user. It's fine to leave it in "Testing" status — you don't need
   to submit for verification for personal use.
4. On the consent screen's **Data access** (or **Scopes**) section, click
   **Add or remove scopes**, search for "Gmail API", and check
   `.../auth/gmail.readonly`. Save. **This step is easy to miss and is
   the #1 cause of a `Gmail profile 403` error** — without it, sign-in
   still appears to succeed (you get the "Connected!" page) but the
   resulting token has no actual Gmail permission, so every Gmail API
   call 403s afterward.
5. Under **Credentials → Create Credentials → OAuth client ID**, choose
   application type **Desktop app**. Create it.
6. Copy the generated **Client ID** and **Client secret** into
   Dashboard's Settings → Google (Gmail).
7. Click **+ Add Gmail account** in Settings. Your browser opens Google's
   consent screen; sign in and approve. Since the app is unverified,
   Google shows an "unverified app" warning — click **Advanced → Go to
   Dashboard (unsafe)** to proceed (this is expected and normal for a
   personal-use OAuth client you created yourself). The consent screen
   should explicitly list "Read your email messages and settings" (or
   similar) among the permissions — if it doesn't, the scope wasn't
   added in step 4.
8. Repeat step 7 for each additional mailbox — every account you connect
   this way gets included in the digest.

If you already went through this once and hit `Gmail profile 403`: add
the scope (step 4), then in Google Account settings →
[Security → Third-party access](https://myaccount.google.com/connections)
remove the existing connection for this app, and reconnect from Settings
so it re-consents with the corrected scope.

Tokens are stored locally via `electron-store`; only ever sent to
Google's OAuth/Gmail endpoints.

**Email excerpt length** (Settings → Google (Gmail), default **200**
characters): how much of each email body gets sent to Ollama. This is the
single biggest lever on how long a sync takes — small/CPU-bound models can
take a very long time per email once the excerpt gets long, so a low
value keeps things snappy at the cost of possibly missing a deadline
buried deep in a long email. Changing this clears the cached message
bodies so the new length applies on the very next refresh instead of
waiting for the normal 3-day cache turnover.

### Ollama

The actionability screening runs entirely on your machine via
[Ollama](https://ollama.com):

```bash
ollama pull qwen2.5:7b   # or whatever model you prefer
ollama serve             # usually already running as a background service
```

In Settings → Ollama, set the host (default `http://localhost:11434`) and
model tag (default `qwen2.5:7b`), then **Test connection** to confirm the
app can reach it and see your pulled models.

No email content ever leaves your machine — the Gmail fetch and the LLM
call both happen locally in the Electron main process.

### Deutsch (German drill)

Nothing to configure — the question bank lives in `src/german-data.js`
and the daily streak is tracked locally via `electron-store`. Each day's
round is five questions: one from each focus area (der/die/das, fixed-case
prepositions, Wechselpräpositionen, verbs with prepositions), plus one
more from a random area. Finishing the round marks the day done and bumps
the streak; "Practice more" runs additional rounds that don't affect the
streak. Missing a day resets the streak to 1 on your next completion.

Want to add more questions or tweak the sets? Just edit the arrays in
`src/german-data.js` — each entry is plain data (`{ noun, answer, hint }`,
etc.), no build step needed.

## Building the macOS app

Run this on a Mac (icon conversion and code signing need macOS tooling):

```bash
npm install
npm run dist
```

This produces a `.dmg` and `.zip` in `dist/` for both Apple Silicon and
Intel. For an unsigned local build you can just run the app from
`dist/mac*/Dashboard.app` — macOS will ask you to confirm opening an
app from an unidentified developer the first time (right-click → Open).

`npm run dist:dir` skips packaging into a dmg/zip and just produces the
unpacked `.app`, which is faster while iterating.

## App icon

`assets/icon.png` (1024×1024) is a **placeholder** I generated to match the
app's look — a donut mark on a soft rounded card — since no icon file
actually reached this session (only mentioned in text). To swap in your
real icon:

1. Replace `assets/icon.png` with your own 1024×1024 PNG (square, no
   transparency needed — macOS handles corner rounding at render time from
   a square source in this electron-builder setup).
2. Re-run `npm run dist`. electron-builder generates the `.icns` from that
   PNG automatically.

`scripts/gen_icon.py` regenerates the placeholder if you want to tweak its
colors/proportions instead (`pip install pillow cairosvg && python3
scripts/gen_icon.py`).

## Previewing without any accounts connected

`node_modules/.bin/electron scripts/preview.js [out.png]` renders the
dashboard with mock Todoist + Gmail data and saves a screenshot — handy
for checking layout changes without real tokens, OAuth, or Ollama running.
Pass `--gmail-state=empty|loading|error|content` to preview a specific
Gmail card state, or `--german-done` to preview the "done for today" state.

## Project structure

```
main.js          Electron main process — window creation, IPC wiring
preload.js       contextBridge API exposed to the renderer
lib/
  store.js       Shared electron-store instance (all settings/tokens)
  todoist.js     Todoist API v1 client + morning-digest bucketing
  gmail.js       Google OAuth (loopback flow) + Gmail message fetching/parsing
  gmailDigest.js Orchestrates gmail.js + ollama.js into one digest
  ollama.js      Local LLM call that screens emails for actionability
  germanDrill.js Daily-streak tracking for the German drill
  logger.js      In-memory log of the Gmail/Ollama pipeline, for the in-app log viewer
src/
  index.html     App shell
  style.css      Neumorphic design system
  app.js         Rendering logic — digest, chart, project modal, Gmail card, German drill, settings
  german-data.js German drill question bank (plain data, edit freely)
assets/
  icon.png       App icon (placeholder — see above)
  icon.svg       Editable source for the icon
```

## Notes / limitations

- Data refreshes on launch, on the refresh button, and every 5 minutes
  while the app is open.
- Priority markers follow Todoist's own convention (P1 highest → P4
  normal); only P1/P2 tasks get a bold marker to keep the list calm.
- The Gmail digest fetches full message bodies (length capped by the
  "Email excerpt length" setting, default 200 characters — see Gmail
  setup above) for better deadline detection than a snippet alone, at
  the cost of Ollama having more to read per email — tune that setting
  if syncs feel slow. Only the *first* sync of a mailbox is slow like
  this: fetched messages are cached locally (they never change once
  sent), so
  later refreshes only fetch genuinely new mail. Overlapping refreshes
  (e.g. clicking refresh while the 5-minute auto-refresh is mid-flight)
  also collapse into a single fetch rather than multiplying — both exist
  specifically to stay well under Gmail API's per-minute quota. Promotions,
  social, and forums categories are excluded from the search up front,
  since they're not actionable anyway.
- The actionability prompt is intentionally strict (see `lib/ollama.js`
  for the exact criteria) — tune it there if it's too strict/loose for
  your inbox.
- **Pipeline logs**: click **Logs** next to "Needs a reply" to see exactly
  what happened on the last sync — every email Gmail returned, each batch
  sent to Ollama, and Ollama's *raw* response before it gets parsed. This
  is the place to look if the digest seems to be finding nothing it
  shouldn't: click an entry to expand its details, and check the raw
  response specifically — if it's non-empty but nothing got flagged, the
  model's output didn't match the expected shape (a bug to report) rather
  than a deliberate "nothing qualifies". Logs update live while a sync
  runs and persist in memory for the session (cleared on quit, or with
  the Clear button).
- The German drill keeps its own in-page session state, so it's
  deliberately excluded from the refresh button and the 5-minute
  auto-refresh — neither will reset a round you're in the middle of.
