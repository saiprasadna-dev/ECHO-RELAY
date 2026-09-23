# ECHO RELAY

**Change my past. Save our future.**

A two-player cooperative browser puzzle adventure. One traveller changes the past; the other anchors an object in the future so it survives the next change. Three connected chambers: **The Root Bridge**, **The Clockwork Lift**, and **The Last Light**.

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

The local server is intentionally loopback-only. For friends on different devices/networks, deploy the complete Worker below. `npm start` runs our Node adapter, **not Cloudflare workerd**.

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
- Separate past/future scenes and clues, exact-condition anchors, all three puzzles and a shared ending.
- Saved checkpoints, reconnect, disconnected-partner pause, and inactive-room expiry.
- Private room messages and quick signals; optional progressive hints.
- Mutually approved lobby role swap, chamber restart and replay with swapped roles.
- Original lightweight SVG scenery, responsive controls, keyboard focus, reduced motion and optional generated sound.
- Clearly labelled local solo practice and an offline practice generator.

## Project map

| Path | Purpose |
| --- | --- |
| `public/app.js` | Entry screen, lobby, game controls, messages, practice and ending |
| `public/scenes.js`, `public/styles.css` | Illustrated scenes and responsive presentation |
| `public/transport.js` | Browser API/WebSocket connection and reconnect handling |
| `public/core/game.js` | Deterministic puzzle rules and role-specific state projection |
| `worker/index.js` | Cloudflare Worker and Durable Object entry points |
| `worker/room-service.js` | Room persistence, authentication and serialized actions |
| `worker/router.js`, `worker/http.js` | API routing, limits and HTTP helpers |
| `scripts/dev-server.mjs` | Dependency-free local HTTP/WebSocket adapter |
| `wrangler.jsonc` | Assets, API routing and SQLite Durable Object migration |
| `tests/` | Rule tests and browser release-verification script |

## Tests

```sh
npm run check
npm test
```

The committed rule suite has **46 passing tests**, including complete solutions across 100 deterministic seeds, wrong-state anchors, private clues, role restrictions, stale/duplicate commands, shared decisions and replay.

Browser verification, with the local server running:

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python tests/browser_smoke.py http://127.0.0.1:8787
```

Pass your own published Worker origin instead to test deployment. The script creates a real test room. [Verification status and remaining checks](docs/TESTING.md) distinguish tested rules/local networking from unverified browser and Cloudflare behavior. This initial version is **not yet claimed contest-ready**.

## Offline practice preview

```sh
node scripts/offline-preview.mjs
```

Open the generated `offline-practice.html` and select solo practice. It contains the scenes and rules but cannot host an online room. It is generated output, not required for deployment.

## Privacy and cost

Rooms hold display names, puzzle progress, hashed session credentials and up to 40 recent messages. Rooms expire after 24 hours without accepted game activity. Do not send sensitive information in game chat. The application adds no analytics, advertising, camera/microphone access or paid model calls. Local adapter saves are in `.local-data/`, ignored by Git.

Cloudflare free quotas can stop service when exceeded. Best-effort per-isolate throttling is not a global traffic or billing guarantee. Check [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [static asset limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) before launch.
