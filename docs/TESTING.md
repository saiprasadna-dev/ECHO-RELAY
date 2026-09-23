# Verification status

September 23, 2026. This report concerns the standalone implementation, not the incomplete Replit project.

## Current committed rule suite: passed

`npm test` ran **46 tests: 46 passed, 0 failed**. The tested rules file matches the committed game engine. Coverage includes full solutions for 100 deterministic seeds, private per-role projections, unauthorized actions, wrong-state anchor capture/release, stale epochs, idempotent actions, pause, mutual reset/swap/replay, hints, messages, expiry and room isolation.

These tests run the deterministic rules in Node. They are not a browser, network, load or Cloudflare-runtime test.

## Earlier local implementation checks: passed

During development, the same application implementation passed a prior 41-test unit/service suite and 16 two-client HTTP/WebSocket checks against the included Node adapter. The latter covered both ready, role ownership, third-player rejection, wrong-state capture, every chamber, future-only network clues, intentional clue sharing, reconnect, complete local process restart with disk recovery, pending-pulse invalidation, ending and shared replay. These counts describe the earlier development run, not extra tests included in the current `npm test` command.

Syntax and local module imports were checked during that run. The local adapter is not Cloudflare workerd, so its results do not establish production-runtime compatibility.

## Browser and deployment checks: pending

An earlier Chromium attempt could not navigate to the local adapter because the build environment blocked the address (`ERR_BLOCKED_BY_ADMINISTRATOR`). No full-browser passing result is claimed. `tests/browser_smoke.py` is provided to verify all chambers through isolated desktop/mobile-sized Chromium contexts, a refresh, private UI clues, ending and role-swapped replay. Its Python syntax was checked; its full browser execution remains pending.

Not yet verified:

- Local Cloudflare Wrangler/workerd execution.
- Cloudflare production deployment and its public URL.
- Two physical devices on different networks.
- Load/abuse testing, independent security review or novice-player usability.

## Release steps

Run `npm run check` and `npm test`. Start `npm start`, then execute the browser script as documented in the README. Repeat with `npm run cloudflare:dev`. Deploy from your own Cloudflare Free account and repeat the browser and manual two-device tests against the actual published origin. Investigate failures rather than treating the local rule results as proof of deployment success.

The first release still needs those checks and player feedback before it is described as contest-ready. Offline practice screenshots establish appearance only, not online multiplayer reliability.
