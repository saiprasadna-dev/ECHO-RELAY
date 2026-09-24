# Deploy ECHO RELAY without Replit

## Current deployment

Published September 24, 2026: **[https://echo-relay.swapmyshow.workers.dev](https://echo-relay.swapmyshow.workers.dev)**. Worker `echo-relay`, version `0e15f441-886b-4646-92f6-fd8800246e6f`, deployed with Wrangler 4.137.0. This includes the static game assets, SQLite-backed `RelayRoom` Durable Object and [Android APK download](https://echo-relay.swapmyshow.workers.dev/downloads/echo-relay.apk). APK 0.2.0 uses the same HTTPS URL by default. Local room codes do not transfer to the production server.

## 1. Run the code first

Install Node.js 22.12+, clone this repository and run `npm start`. Open the printed loopback URL using two different browser profiles. Run `npm run check` and `npm test`.

The local adapter requires no dependencies and is not a production server. It binds only to 127.0.0.1. Use the Cloudflare deployment for separate devices over the internet.

## 2. Use Cloudflare Workers Free

Sign in to your Cloudflare account. Keep Workers on the Free plan; do not accept a paid upgrade simply to follow this guide. The app needs SQLite-backed Durable Objects, which are available on Workers Free. It does not need a custom domain, paid AI API or separate database service.

From the repository root:

```sh
npx --yes wrangler@4.137.0 login
npm run cloudflare:dev
```

Authorize in your own browser. Do not paste account tokens into chat or commit credentials. Test the local Cloudflare preview. This uses the actual Cloudflare runtime; passing our Node adapter tests does not replace this check.

Then publish explicitly:

```sh
npm run deploy
```

Wrangler bundles the Worker, uploads `public/`, and creates the configured Durable Object namespace through migration `v1`. On a first deployment, choose a workers.dev subdomain if prompted. Use the playable URL printed after success. No public game URL exists merely because the repository was created.

If a Worker called `echo-relay` already exists in your account and is unrelated, choose a different `name` in `wrangler.jsonc` before deploying. Do not overwrite an unrelated service or delete an existing namespace to resolve a naming conflict.

## 3. Deploy the backend as well as the frontend

Do not upload only `public/` to static-only Pages. Online multiplayer needs:

- Worker entry: `worker/index.js`.
- Static assets: `public/` with binding `ASSETS`.
- Worker-first API routes: `/api/*`.
- Durable Object binding: `ROOMS`, class `RelayRoom`.
- Migration: `new_sqlite_classes: ["RelayRoom"]`.

These are already in `wrangler.jsonc`. Do not replace the SQLite migration with legacy key-value class configuration. Do not rewrite migration history for a service that has already been deployed.

The npm scripts pin Wrangler to the verified deployment version, `4.137.0`. There is no automatic deployment workflow: Git pushes and Cloudflare deployments are separate actions.

The APK and checksum in `public/downloads/` are build artifacts ignored by Git. Keep them present when deploying updates, or regenerate them using the [Android guide](ANDROID.md), to preserve the public download.

## 4. Check two real devices before sharing widely

Open the published link on a laptop and a phone, preferably on different networks. Create/join, solve every chamber, refresh during an anchored puzzle, disconnect/reconnect a partner, restart a chamber by mutual agreement, and replay with swapped roles. Confirm mobile controls do not overflow.

The included browser script also accepts your published origin:

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python tests/browser_smoke.py https://YOUR-WORKER.workers.dev
```

Only test a deployment you own or have permission to test. The script creates a temporary room.

## Free does not mean unlimited

The intended hosting setup is Workers Free plus SQLite Durable Objects and the provided workers.dev hostname. Static assets and API/Durable Object usage have different allowances. When a free quota is exhausted, operations can fail until reset. Stay on Free and review usage in the dashboard; this application does not guarantee unlimited capacity. The in-code per-isolate creation throttle is not comprehensive abuse protection.

Official references checked September 23, 2026:

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/

## Troubleshooting

**Both tabs show the same role:** tabs share cookies. Use another browser or an incognito profile for the second participant.

**Cannot recover a role:** reopen the room in the original browser/profile. A room code is an invitation, not an ownership credential. Cookies must be allowed.

**Partner disconnected:** their role and progress remain reserved. Reopen the same room in their original browser. Puzzle advancement pauses while a partner is absent.

**API returns HTML:** deploy the whole Worker and preserve `run_worker_first: ["/api/*"]`; a static-only upload does not implement the room API.

**Binding/migration error:** confirm `ROOMS`, `RelayRoom`, and the SQLite migration match the checked-in configuration. Do not delete production data or namespaces as a first fix.

**Free quota exhausted:** inspect usage and wait for the relevant reset. This does not prevent writing or testing the game locally.

## Verification

Cloudflare authorization and production deployment succeeded. The published homepage and browser room creation work, and `/api/health` returns HTTP 200. Local workerd also passed the guided bridge puzzle and checkpoint reconnect. See [TESTING.md](TESTING.md) for the recorded production checks and remaining physical-device validation.
