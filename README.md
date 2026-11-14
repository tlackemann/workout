# Gym TV

A self-hosted Push / Pull / Legs workout player for the home-gym TV, driven entirely by the TV remote.
Pick a day and it builds the session from your equipment, shows each exercise's start/end poses
(alternating at rep tempo), runs get-ready / rest timers with beeps, and logs weights and reps so
next session's targets progress automatically (double progression).

```
Home ──OK──▶ Preview ──OK──▶ Player ───────────────▶ Summary
(Push/Pull/   (swap, shuffle,  OK = set done → rest   (PRs, next
 Legs)         Quick/Std/Long)  rest runs out → next   targets)
                                BACK = pause menu
```

## Quick start

```bash
npm install
npm run dev            # API on :8787, TV UI on :5173 (proxying /api)
```

Open <http://localhost:5173>. Arrow keys / Enter / Escape behave exactly like the remote's D-pad / OK / Back.

## Running it for real

```bash
docker build -t gym-tv .
docker run -d --name gym-tv -p 8787:8787 -v gym-tv-data:/data --restart unless-stopped gym-tv
```

Everything persistent lives in `/data`: the SQLite database and optional photo overrides.
Without Docker: `npm ci && npm run build && npm start`.

### Deploying to the homelab over SSH

`npm run deploy` builds locally, rsyncs only what the server runs (`dist/`, `drizzle/`, `src/{core,data,server}`,
`package*.json`) to `tom@192.168.0.113:/var/www/workout`, runs `npm ci --omit=dev` there, restarts the `gym-tv`
service and checks `/api/health`. `data/` (the database) and `node_modules/` on the server are never touched.
Override with `DEPLOY_HOST`, `DEPLOY_DIR`, `DEPLOY_SERVICE`, `DEPLOY_PORT`; preview with `npm run deploy -- --dry-run`.

One-time server setup: Node 24+, `mkdir -p /var/www/workout/data`, then install
[`deploy/gym-tv.service`](deploy/gym-tv.service) (instructions at the top of the file).

> **No authentication.** It's built for a trusted LAN. If you expose it beyond that, put it behind your
> reverse proxy's auth.

## TV setup (TCL Google TV + Fully Kiosk Browser)

1. **Device check first.** Open `http://<server>:8787/tv-check.html` on the TV. Press every remote button, press
   OK once (it should beep), press Back a few times, and leave it open 20 minutes. It shows which key codes
   arrive, whether Back comes through as a `popstate`, the viewport size and DPR, and whether the screen stays on.
   If anything differs from what [`keymap.ts`](src/client/input/keymap.ts) expects, adjust it there.
2. Install **Fully Kiosk Browser** from the Play Store and set:
   - *Start URL*: `http://<server>:8787/`
   - *Fullscreen mode*: on
   - *Keep screen on*: on (stops Google TV's ambient screensaver mid-rest)
   - *Autoplay videos/audio*: on
   These are free features; Kiosk Mode / Screensaver / Remote Admin need PLUS and aren't required.
3. Launch on boot: some TCL Google TVs also need
   `adb shell appops set de.ozerov.fully APP_AUTO_START allow`.
4. Long-pressing Back opens Fully's own menu, so the app never uses long-press Back.

Over plain HTTP the Wake Lock API isn't available (it needs a secure context), so Fully's *Keep screen on*
is what keeps the TV awake. If you serve the app over HTTPS, Wake Lock works too.

## Using it with the remote

| Screen | ◀ ▶ | ▲ ▼ | OK | Back |
|---|---|---|---|---|
| Home | choose day | move | plan workout | — |
| Preview | length / shuffle | move through exercises | Start, or options on a row (swap / favourite / never suggest) | home |
| Player: get ready | weight | — | start now | pause menu |
| Player: work | weight | — | **set done** | pause menu |
| Player: rest | weight | reps | start next set now | pause menu |
| Pause menu | — | move | Resume · +30 s · skip set/warm-ups/exercise · swap · end | resume |
| Progress | switch view (Lifts · Consistency · Sessions · Muscles) | Lifts: pick an exercise | — | home |

The normal flow needs only **one OK per set**: the log is pre-filled with the target and auto-saves when rest
ends. If you missed reps, press ▼ while resting. Leaving mid-workout is safe: Home shows **Resume**, a reload
restores the exact set and remaining rest (paused), and walking away for a long time advances one phase then
pauses.

## Customising

- **Settings screen** (also works by touch from a phone at the same URL): equipment toggles (dumbbells, pull-up bar
  and dip bars are already in the library, just switch them on), main lifts per day, plate inventory, bar weights,
  MX 4800 plate size / max per station, progression jumps, sounds, session length.
- **Your own photos**: drop `0.jpg` (start pose) and `1.jpg` (end pose) into `/data/media-overrides/<exercise-id>/`
  (ids are in [`src/data/library.ts`](src/data/library.ts)). They replace the stock photos, which is the best
  way to get the actual MX 4800 stations on screen.
- **Exercises and day templates** are code: [`src/data/library.ts`](src/data/library.ts) and
  [`src/data/templates.ts`](src/data/templates.ts). After adding an exercise, run `npm run fetch-media`.

## How it works

| Piece | Where | Notes |
|---|---|---|
| Domain core (pure, no I/O) | `src/core/` | generator, double progression, plate DP solver, session state machine, summary, progress stats; shared by client and server |
| Data | `src/data/` | ~80 curated exercises (equipment requirements as AND-of-ORs), PPL slot templates |
| API | `src/server/` | Hono + Drizzle + SQLite, zod-validated, `{ success, data, error }` envelope, repositories |
| TV UI | `src/client/` | React + Tailwind v4, 10-foot UI scaled from the viewport, Norigin spatial navigation for menus |
| Media | `public/media/` | start/end frames from free-exercise-db, normalised to 900×600 WebP by `npm run fetch-media` |

- The **player** is a pure reducer: every event carries `now`, timers are deadlines (never tick counting), and each
  revision is mirrored to localStorage and saved to the server (stale revisions get a 409).
- The **generator** keeps 1–2 fixed anchor lifts per day and fills accessory slots with a seeded, weighted pick:
  favourites up, recently used down (graded over the last three sessions of that day), banned out, no repeated
  movement family, and slots that relax rather than fail when equipment is missing. If a slot would repeat last
  session's exercise anyway, related variations and the slot's wider movement pattern rotate in. Sessions are
  trimmed by priority to fit Quick / Standard / Long, then the accessories are shuffled (anchors stay first;
  finisher and core stay last).
- **Progress** (`GET /api/stats`, pure functions in `src/core/stats/`): estimated 1RM and top set per lift with PRs,
  a 26-week heatmap and weekly streak (in the TV's time zone), workout length and volume per day, and working sets
  per muscle over the last four weeks. Charts are static SVG, no chart library.
- **Progression**: hit the top of the rep range on every set → add weight (5 lb upper, 10 lb lower, one plate on
  stacks, next loadable total for bars). Two failed sessions in a row → −10%. More than six weeks away → −10%.
  Bodyweight moves level up through variants (incline → floor → handles → decline push-ups).

## Development

```bash
npm test               # unit + integration (Vitest)
npm run coverage       # with coverage report
npm run e2e            # Playwright: whole sessions driven by remote keys, at 1920×1080 and 960×540@2x
npm run typecheck
npm run db:generate    # after changing src/server/db/schema.ts
npm run fetch-media    # download/normalise frames for new library entries
```

## Credits

- Exercise photos and base instructions: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense).
  The upstream doesn't document where the photos came from, so keep your instance private.
- Muscle maps: [body-highlighter](https://github.com/lahaxearnaud/body-highlighter) (MIT).
- Spatial navigation: [Norigin Spatial Navigation](https://github.com/NoriginMedia/Norigin-Spatial-Navigation) (MIT).
- Fonts: Barlow / Barlow Condensed (SIL OFL) via Fontsource.
