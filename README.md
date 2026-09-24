# ECHO RELAY

**Change my past. Save our future.**

**Play online:** [echo-relay.swapmyshow.workers.dev](https://echo-relay.swapmyshow.workers.dev). Use this same HTTPS address in the Android launcher. Online rooms are separate from rooms saved on your local development server.

A two-player cooperative walking adventure. One traveller changes the past; the other anchors an object in the future so it survives the next change. Walk to objects to discover clues and controls across **The Root Bridge**, **The Clockwork Lift**, **The Last Light**, **The Moonlit Canal**, **The Storm Tower**, and **The Reunion Garden**. Both travellers reach the meeting circle before the shared celebration.

This is the standalone game source, not the incomplete Replit build. No Replit subscription, paid AI API, player account or custom domain is needed by the application.

## Run on your laptop

Install Node.js 22.12 or later, then:

```sh
git clone https://github.com/saiprasadna-dev/ECHO-RELAY.git
cd ECHO-RELAY
npm start
```

Open `http://127.0.0.1:8787`. No npm dependencies or build step are needed for this local development adapter. Create a room in one browser and join its code from another browser or an incognito profile. Tabs in the same profile share the same role's private cookie, so they are not separate players.

For a quick first look, choose **Explore both eras in solo practice**. Practice is local to one screen and is not online multiplayer.

Tap or click a scene marker to walk there. Arrow keys and WASD also move your traveller; typing in chat does not move them. Puzzle controls appear only within reach of the relevant object. Create a **new room** for the six-destination adventure: saved rooms from the original version retain their three-chamber rules and progress.

**Easy guide** is on by default. Follow **Your next move** above the scene: its button walks you to the highlighted object, then shows the next action when you arrive. It tells you when to wait for your partner, lets you share a discovered clue, and offers a **Level walkthrough** with numbered instructions. In solo practice, **Now play Past/Future** switches to the next role. Existing six-destination rooms receive the guide after refreshing, with progress preserved.

For the first bridge: **Past → Grow; Future → Preserve; Past → Drain; Future → Cross.** Preserve means keeping an object in its current condition while Past changes the world again.

The local server is loopback-only by default. Use `npm run start:lan` to opt into testing with phones on the same private Wi-Fi. For friends on different networks, deploy the complete Worker below. `npm start` runs our Node adapter, **not Cloudflare workerd**.

## Android app

An Android project is included in `android/`. It bundles all six destinations for offline practice and connects to the same multiplayer server as browser players. Build the installable Wi-Fi test APK with `npm run android:build`; read [the Android guide](docs/ANDROID.md) for SDK setup, installation and two-phone testing.

## Deploy to Cloudflare

Use **Workers with Static Assets and SQLite-backed Durable Objects**, not a static-only Pages upload. Stay on Workers Free for the intended no-cost setup; free quotas still apply.

```sh
npx --yes wrangler@4 login
npm run cloudflare:dev
# After testing that preview:
npm run deploy
```

Wrangler prints the actual public `workers.dev` URL after a successful deployment. That is the playable link; this GitHub repository URL is the source code. No Cloudflare deployment has been performed as part of this initial handoff.

Read [the deployment guide](docs/DEPLOYMENT.md), including the free-tier limits and two-device checks, before publishing. Deployment remains a manual action from your own account. No automatic deployment workflow or paid dependency is included.

## What is implemented

- Server-authoritative two-player HTTP/WebSocket rooms, invitation links and private session cookies.
- Separate past/future scenes and clues, exact-condition anchors, five puzzle destinations and a shared reunion garden.
- Server-validated walking, time to reach each object, contextual controls and a blocked canal crossing until the bridge is safe.
- Saved checkpoints, reconnect, disconnected-partner pause, and inactive-room expiry.
- Private room messages and quick signals; optional progressive hints.
- Mutually approved lobby role swap, chamber restart and replay with swapped roles.
- Cinematic environment artwork, distinct garden eras, animated water/anchors/machinery/portal, responsive controls, keyboard focus, reduced motion and optional generated sound.
- Clearly labelled local solo practice and an offline practice generator.

## Project map

| Path | Purpose |
| --- | --- |
| `public/app.js` | Entry screen, lobby, game controls, messages, practice and ending |
| `public/scenes.js`, `public/styles.css`, `public/cinematic.css` | Scene compositing, state-driven motion and responsive presentation |
| `public/assets/` | Optimized environment artwork; [art direction and prompts](docs/ART-DIRECTION.md) |
| `public/transport.js` | Browser API/WebSocket connection and reconnect handling |
| `public/core/game.js` | Deterministic puzzle rules and role-specific state projection |
| `public/core/travel.js`, `public/travellers.js` | Walkable ground, interaction locations, movement and reunion animation |
| `public/adventure-controls.js`, `public/adventure.css` | Nearby object controls and responsive walking presentation |
| `public/journey-guide.js` | Role-specific next steps, clue sharing and numbered level walkthroughs |
| `worker/index.js` | Cloudflare Worker and Durable Object entry points |
| `worker/room-service.js` | Room persistence, authentication and serialized actions |
| `worker/router.js`, `worker/http.js` | API routing, limits and HTTP helpers |
| `scripts/dev-server.mjs` | Dependency-free local HTTP/WebSocket adapter |
| `wrangler.jsonc` | Assets, API routing and SQLite Durable Object migration |
| `tests/` | Rule tests and browser release-verification script |
| `android/` | Native Android launcher, bundled offline game and multiplayer WebView |
| `scripts/build-android.ps1` | Build, test, lint and export the Android test APK |

## Tests

```sh
npm run check
npm test
```

The Node suite has **67 tests**: 46 original rule tests, 11 adventure tests (including full six-destination solutions across 100 deterministic seeds), six guide tests, one local HTTP adapter test and three network tests. They cover movement timing, proximity, blocked paths, private clues, both new puzzles, reunion, checkpoint reset and replay, alongside the original authentication and puzzle cases. Guide tests cover correct role handoffs, arrival before action, wrong-object recovery, clue privacy, valid locations/actions for all six levels and waiting for the second pulse. The Android project includes JVM tests and native/WebView instrumentation journeys; see [the verification report](docs/TESTING.md) for the latest results.

Browser verification, with the local server running:

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python tests/browser_smoke.py http://127.0.0.1:8787
```

Pass your own published Worker origin instead to test deployment. The script creates a real test room. [Verification status and remaining checks](docs/TESTING.md) record a successful interactive local browser playthrough and distinguish it from the still-pending Python browser script, Cloudflare runtime and real-device checks. This initial version is **not yet claimed contest-ready**.

## Offline practice preview

```sh
node scripts/offline-preview.mjs
```

Open the generated `offline-practice.html` and select solo practice. It contains the scenes and rules but cannot host an online room. It is generated output, not required for deployment.

## Privacy and cost

Rooms hold display names, puzzle progress, hashed session credentials and up to 40 recent messages. Rooms expire after 24 hours without accepted game activity. Do not send sensitive information in game chat. The application adds no analytics, advertising, camera/microphone access or paid model calls. Local adapter saves are in `.local-data/`, ignored by Git.

Cloudflare free quotas can stop service when exceeded. Best-effort per-isolate throttling is not a global traffic or billing guarantee. Check [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [static asset limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) before launch.
