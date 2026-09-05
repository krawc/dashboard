# Dashboard

A minimalist, greyscale personal dashboard for macOS, built with Electron.

Currently shows:
- **Task summary** — open/overdue/due-today/upcoming counts and a breakdown by priority, from Todoist.
- **Projects** — a donut chart of open tasks per project, in a greyscale palette.

Designed to be airy and neumorphic: soft off-white surfaces, subtle extruded
shadows, Roboto Mono for titles/labels/numbers, Roboto for body text.

## Setup

```bash
npm install
npm start
```

On first launch, click the gear icon and paste your Todoist API token
(Todoist → Settings → Integrations → Developer — the app links there
directly from the settings panel). The token is stored locally via
`electron-store` and never leaves your machine except to call the Todoist
API directly.

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
app's look — a greyscale donut mark on a soft rounded card — since no icon
file actually reached this session (only mentioned in text). To swap in
your real icon:

1. Replace `assets/icon.png` with your own 1024×1024 PNG (square, no
   transparency needed — macOS handles corner rounding at render time from
   a square source in this electron-builder setup).
2. Re-run `npm run dist`. electron-builder generates the `.icns` from that
   PNG automatically.

`scripts/gen_icon.py` regenerates the placeholder if you want to tweak its
colors/proportions instead (`pip install pillow cairosvg && python3
scripts/gen_icon.py`).

## Previewing without Todoist

`node_modules/.bin/electron scripts/preview.js [out.png]` renders the
dashboard with mock data and saves a screenshot — handy for checking layout
changes without a real API token.

## Project structure

```
main.js        Electron main process — window, Todoist API calls, token storage
preload.js     contextBridge API exposed to the renderer
src/
  index.html   App shell
  style.css    Neumorphic greyscale design system
  app.js       Rendering logic (stats, priority bars, donut chart, legend)
assets/
  icon.png     App icon (placeholder — see above)
  icon.svg     Editable source for the icon
```

## Notes / next steps

- Data refreshes on launch, on the refresh button, and every 5 minutes
  while the app is open.
- Priority rows are labelled P1 (urgent) → P4 (normal), matching Todoist's
  own convention.
- The "Projects" chart currently counts **open tasks per project** — happy
  to switch it to project count/status or add more widgets (calendar,
  habits, etc.) as next iterations.
