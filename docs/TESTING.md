# Verification status

Updated September 24, 2026. This report concerns the standalone implementation, not the incomplete Replit project.

## Current automated suite: passed

`npm test` ran **67 tests: 67 passed, 0 failed** on Windows with Node.js 22.16.0. The original 46 rule tests cover full solutions for 100 deterministic seeds, private per-role projections, unauthorized actions, wrong-state anchor capture/release, stale epochs, idempotent actions, pause, mutual reset/swap/replay, hints, messages, expiry and room isolation. Eleven adventure tests additionally cover walking time and bounds, arrival/proximity enforcement, blocked bridge crossing, mid-walk destination changes, checkpoints, private clues, wrong-state canal/tower recovery, simultaneous presence at the meeting point, replay, and six-destination solutions across 100 seeds. A local-adapter integration test starts an isolated server and verifies HTML, JavaScript modules (including nested paths), CSS and image assets, plus rejection of missing files and encoded directory traversal. Three network tests cover loopback defaults, the Wi-Fi opt-in host allowlist and private IPv4 boundaries.

The rule tests run in Node; the adapter test uses real local HTTP requests. Neither is a browser, load or Cloudflare-runtime test. `npm run check` also passed for 21 JavaScript modules.

## Easy guide revision: passed

The guide is enabled by default and uses a public progress phase to identify the next role/action. Shape, constellation, tide and heading values remain private to Future; the guide only offers clue text at the relevant location. Six additional tests cover role handoffs, proximity before actions, pause, wrong-object recovery, private clue sharing, valid guidance locations/actions in every destination, the second pulse and solo role switching.

The in-app browser completed the first bridge entirely through the guide, then checked the workshop clue, role switching, guide toggle and current-level walkthrough. The existing room `L4E6YH` reconnected and showed the correct Future-turn advice with its saved progress intact.

On the API 36 Android emulator, both offline/recovery instrumentation tests passed in **137.303 seconds**. The bridge now explicitly tests the guide's walk, Grow and Drain buttons and the Future-turn message. The same run completed all six destinations, reunion, replay, rotation/background, back confirmation and connection recovery. The crash log was empty, and the portrait guide screenshot was inspected. Android assembly, 4 JVM tests and lint passed with 0 errors and 12 warnings. A final wording-only rebuild clarified the clue instruction for solo practice; that wording-only package was not subjected to a second complete emulator run.

The previous Android/browser multiplayer playthrough remains recorded below; it was not repeated in full for this guide revision. Current guide evidence is in `test-results/android/offline-and-recovery.txt` and `e2e/02-offline-past.png`.

## Original six-destination walking adventure: passed

The updated Android APK and browser completed the Root Bridge, Clockwork Lift, Last Light, Moonlit Canal, Storm Tower and Reunion Garden. New rooms use this adventure; existing three-chamber room saves retain their original rules and progress.

- **Final packaged offline run:** two Android instrumentation tests passed in 86.051 seconds on the API 36 emulator. Real WebView taps moved the character to scene markers, revealed controls only after arrival, solved all six destinations, brought both travellers to the meeting point, displayed the celebration, and replayed. Rotation, background/resume, back confirmation, invalid server input and unreachable-server recovery also passed.
- **Android plus laptop multiplayer:** one instrumentation test passed in 448.611 seconds in room `UXBNK2`. Android played Future and the in-app browser played Past. Both walked to puzzle stations, shared visible clues in chat, recovered from a wrong bridge anchor, completed all six destinations, met and saw the ending. Activity recreation and exit/rejoin preserved the workshop checkpoint and session. The final offline run additionally checked the last presentation and scroll adjustments packaged into the APK.
- **Presentation:** scene markers were tested by tapping the visible environment. This caught and fixed a CSP issue with marker coordinates. The reunion shows both travellers side by side with petals. Final native screenshots include all three new environments and the fully painted ending. Artwork and prompts are documented in [ADVENTURE-ART.md](ADVENTURE-ART.md).
- **Build:** Android assembly, all 4 JVM tests and lint passed; lint reports 0 errors and 12 warnings. The final debug APK is 14,765,598 bytes, SHA-256 `e1de67ef73fa09686aa047a26f301f73476fb9c77e554bed19b26c2c3fb63390`. Downloading `/android.apk` over the Wi-Fi address returned the same SHA-256. The successful offline and multiplayer crash logs are empty.

Evidence is retained in ignored `test-results/android/`: `offline-and-recovery.txt`, `online.txt`, their crash logs, and screenshots under `e2e/` including `06-offline-ending.png`, `11-offline-canal.png`, `12-offline-tower.png` and `13-offline-reunion.png`. `tests/browser_smoke.py` was updated for walking and all six destinations but was not executed; browser participation in the multiplayer check was interactive through the in-app browser. These results cover the local Node backend and an Android emulator, not physical-phone performance or Cloudflare production.

## Earlier local implementation checks: passed

During development, the same application implementation passed a prior 41-test unit/service suite and 16 two-client HTTP/WebSocket checks against the included Node adapter. The latter covered both ready, role ownership, third-player rejection, wrong-state capture, every chamber, future-only network clues, intentional clue sharing, reconnect, complete local process restart with disk recovery, pending-pulse invalidation, ending and shared replay. These counts describe the earlier development run, not extra tests included in the current `npm test` command.

Syntax and local module imports were checked during that run. The local adapter is not Cloudflare workerd, so its results do not establish production-runtime compatibility.

## Local browser playthrough: passed

The Codex in-app browser completed all three chambers against the Node adapter on Windows. Two tabs used `127.0.0.1:8787` and `localhost:8787` to maintain separate origin-scoped player sessions connected to the same room. This was an interactive browser verification, not an execution of `tests/browser_smoke.py` or a two-device test.

Verified:

- Room creation, invitation join, separate roles and both-player readiness.
- Chat delivery and different controls/clues for each era.
- Incorrect stump anchoring, release/recovery, grown-bridge anchoring and crossing.
- Partner-disconnect pause with disabled puzzle controls; rejoin and refresh preserved the anchor and progress.
- Mutually approved chamber restart retained the earlier garden checkpoint.
- Working-drive anchoring, power routing and lift completion.
- Ordered constellation matching, charged-lens anchoring and portal power.
- First pulse waited for the second player; both saw the completed ending.
- Mutually approved replay swapped roles and returned both players to the lobby.
- Help dialog; solo practice start, era switching, progressive hints, full solution and first-chamber completion.
- Desktop presentation and a 390 x 844 viewport; the checked mobile bridge and ending screens had no horizontal overflow.

The playthrough uncovered a Windows asset-serving bug: the containment check used a hardcoded `/` after a path resolved with Windows separators. The adapter now uses `node:path`'s platform separator. The new adapter integration test guards this behavior while checking that traversal stays blocked.

`tests/browser_smoke.py` remains available for repeatable isolated-browser release verification; that Python script has not been executed in this session.

## Cinematic presentation revision: checked locally

After replacing the vector scenes with the cinematic environment layers, an interactive solo playthrough completed all three chambers and the ending. The final garden variants were checked for past/future switching, grown bridge, reflective flooded water, anchor capture, draining and crossing. The workshop and active portal were visually inspected. The checked 390 x 844 garden and ending views had no horizontal overflow, and the inspected browser tabs reported no warning/error logs. The original multiplayer room reconnected after the local server restart and loaded the redesigned interface.

The 47-test suite and syntax checks passed again. The adapter integration test now verifies the cinematic stylesheet and all six WebP files with correct MIME types and WebP signatures. The offline practice generator ran, its generated script parsed, and its artwork/styles were embedded rather than left as server-dependent references. This does not establish frame-rate performance on physical mobile devices or production compatibility.

## Original Android Wi-Fi build: earlier checks

On 2026-09-24, the Android debug APK built successfully with Android Gradle Plugin 8.13.2, Gradle 8.13, JDK 21, compile/target SDK 36 and minimum SDK 26. Output: `dist/echo-relay-android-debug.apk` (3,887,799 bytes). The Android APK signer verified its v2 signature. Package inspection confirmed the INTERNET permission and inclusion of all six WebP environments and the game scripts/styles.

Checks performed:

- `npm run check` and all **50 Node tests** passed. The final adapter/network subset passed again after adding APK delivery; default loopback mode rejects `/android.apk`.
- **4 Android JVM tests** passed for private Wi-Fi addresses, HTTPS release requirements, malformed/unsafe inputs, invitation URLs, and exact origin comparison.
- `assembleDebug` and `lintDebug` succeeded: **0 lint errors**. Lint still reports 6 non-blocking warnings; no release readiness is inferred from compilation.
- Two browser sessions connected through the computer's Wi-Fi address and localhost on port 8788, created/joined a room, readied both players, solved the bridge and advanced to the workshop. They reconnected after a server restart with progress preserved.
- A browser preview of the actual generated Android assets opened practice directly, showed the offline-only home, switched eras and completed the first chamber without a multiplayer backend. No error logs were reported in that preview. This was asset testing in a browser, **not execution in Android WebView**.
- The Wi-Fi APK download returned HTTP 200 and the correct MIME type. Its SHA-256 matched the local build: `6714f3b3f25da38ab8fe9e60a62b370726ad9ab2dba171177d44e65b56ae3a03`.

At the initial build, no Android device was attached. The subsequent emulator checks below now cover installation, native launcher/WebView execution, rotation, background/resume, Android back and chat keyboard input. Two physical phones, hardware-specific cutouts, audio output and frame-rate performance remain unverified. No signed release/AAB/Play Store publication was performed. See [ANDROID.md](ANDROID.md) for installation and the first phone test.

## Original three-chamber Android emulator tests: earlier checks

On 2026-09-24, the installed debug APK passed **3 Android instrumentation tests** on Android 16 / API 36: two offline/recovery cases and one multiplayer case. The device was `ECHO_API36`, a Pixel 5-based 720 × 1280 virtual phone using official Android Emulator 37.1.11 and the Google APIs x86_64 system image, revision 7. Google's Android Emulator Hypervisor Driver 2.2 was installed with the user's approval; its acceleration check returned code 0. The successful run used hardware acceleration, host graphics, 4 cores and 3,072 MB of virtual RAM.

`GameJourneyTest` used Espresso, Espresso Web and UI Automator against native controls and the real Android WebView. Puzzle actions and clue reading used the visible UI, not direct game-model calls.

- **Offline full journey:** all three chambers, role switching, ordered constellation matching, both final pulses, ending, replay and return to the native menu. Rotation to landscape and back, background/resume, and cancelling the Android back confirmation preserved the active run.
- **Input/error recovery:** unsafe `file://` input rejected, unreachable server displayed a native error, retry returned the error, and returning to the menu allowed offline play.
- **Multiplayer full journey:** Android played Future and the in-app browser played Past in room `FNL7FL`, using the local Node server on port 8788 through ADB port forwarding. Verified invitation join, readiness, wrong-stump anchoring and release, grown-bridge crossing, private clue sharing through chat, the lift, all three constellation rings, and both final pulses. Both clients displayed the completed ending. Activity recreation and a native-menu exit/rejoin in the workshop restored the saved checkpoint and connected session.
- **Visual evidence:** captured the launcher, portrait/landscape gameplay, connection error, reconnected workshop, observatory and both endings. The inspected mobile views had readable controls and no observed horizontal clipping. The emulator crash buffer was empty after the successful runs.

The two offline/recovery cases completed in 35.420 seconds (`OK (2 tests)`); the multiplayer case completed in 144.301 seconds (`OK (1 test)`). Reproduce with `npm run android:test`; use the separate browser-partner command in [ANDROID.md](ANDROID.md) for multiplayer. Evidence is saved locally in the ignored `test-results/android/` directory: `offline-and-recovery.txt`, `online.txt`, `emulator-crashes-after-tests.txt`, and 12 PNGs under `e2e/`.

Setup failures are retained separately: software emulation failed before Android booted; the first accelerated boot displayed an Android System UI ANR, resolved by restarting the emulator with the successful configuration above. One multiplayer attempt timed out because the browser partner action arrived after the test's 90-second wait; its log is `online-partner-timeout.txt`. The complete fresh-room rerun passed. These emulator results do not establish two-phone Wi-Fi connectivity, physical-device performance, or production Cloudflare behavior.

## Cloudflare deployment preparation: passed

Wrangler 4.137.0 successfully built the deployment with `deploy --dry-run`: 26 public asset files and a 40.03 KiB Worker bundle (11.74 KiB gzip), with the `ROOMS` SQLite Durable Object and `ASSETS` bindings. The actual local workerd runtime started on port 8790 and returned a healthy `/api/health` response.

Two browser origins created/joined room `39A2HG` against that runtime, established WebSocket sessions, readied both players, followed the guided Grow → Preserve → Drain → Cross sequence and reached the workshop. Refreshing Future retained its role and workshop progress. This local UI check covers the first level and checkpoint reconnect. The subsequent production verification is recorded below.

## Cloudflare production: deployed and checked

On September 24, 2026, Wrangler 4.137.0 deployed `echo-relay` to **[https://echo-relay.swapmyshow.workers.dev](https://echo-relay.swapmyshow.workers.dev)**, version `2464975b-bd6d-4d7f-b58e-a66e5601cf14`. The Worker uses the configured `ROOMS` SQLite Durable Object and `ASSETS` bindings. The public health endpoint returned HTTP 200. The in-app browser loaded the artwork, created room `YPK7L5`, and displayed a connected lobby with a complete HTTPS invitation; the inspected page had no horizontal overflow.

Two independent HTTP/WebSocket clients completed all six destinations on the production origin in room `P2C8Z5`. Verified room creation/joining, both-player readiness, rejection of an untrusted Origin and an unauthenticated session request, walking/proximity enforcement, chat delivery, private role projections, disconnect pause, reconnect with the grown bridge still preserved, every puzzle, both portal pulses, the shared reunion/ending and mutually approved replay with swapped roles.

This was a production **protocol test**, not an automated browser or physical-phone playthrough. An initial test run reached the storm tower before the test client attempted its next action ahead of the other socket's level update; waiting for both clients' next-level state corrected the test, and a fresh full run passed without application changes. Local evidence is retained in ignored `test-results/cloudflare-live.mjs` and `test-results/cloudflare-live.txt`. The existing two-client UI release script remains unexecuted.

## Android public-server APK: passed

On September 24, 2026, Android APK **0.2.0-test**, version code **2**, was built with `https://echo-relay.swapmyshow.workers.dev` as its default. The exported package passed APK signature verification. Six JVM tests passed, including migration from the older Wi-Fi address, preservation of custom HTTPS addresses and retention of later manual local-server choices. Android lint reported **0 errors and 12 warnings**.

The APK installed as an update over the previous test app on `ECHO_API36` (Android 16). The focused `publicServerUpgradeConnectsWithoutEditingAddress` instrumentation test passed in **16.591 seconds**: it seeded an old local invitation, recreated the launcher, checked the prefilled Cloudflare address and internet instructions, tapped Connect without editing the address, created a production room and observed **Relay connected** in the Android WebView. This focused check does not claim a full six-level production UI playthrough. Evidence is retained under ignored `test-results/android/`: `public-server-upgrade.txt`, `14-public-server-launcher.png` and `15-public-server-lobby.png`.

APK SHA-256: `31837710e949613157b080f1658899c58e866f16242156d6a7bfbefecd428cae` (14,754,965 bytes). The package retains `com.echorelay.game.debug` and the existing development signing key for in-place updates. Offline assets exclude downloadable APKs.

Published at `/downloads/echo-relay.apk` in Worker version `0e15f441-886b-4646-92f6-fd8800246e6f`. Download verification returned HTTP 200, Android package MIME type and attachment disposition; its SHA-256 matched the exported APK exactly. `/api/health` also returned HTTP 200. Evidence: `test-results/android/public-apk-download.json`.

To repeat this focused live-service check after building/installing both APKs:

```powershell
adb -s emulator-5554 shell am instrument -w -r -e class 'com.echorelay.game.GameJourneyTest#publicServerUpgradeConnectsWithoutEditingAddress' -e publicServerCheck true com.echorelay.game.debug.test/androidx.test.runner.AndroidJUnitRunner
```

## Broader release checks: pending

Not yet verified:

- A complete six-destination browser/Android UI playthrough on the public origin (production protocol playthrough passed above).
- Two physical devices on different networks.
- Load/abuse testing, independent security review or novice-player usability.

## Release steps

Run `npm run check` and `npm test`. Start `npm start`, then execute the browser script as documented in the README. Repeat with `npm run cloudflare:dev`. Deploy from your own Cloudflare Free account and repeat the browser and manual two-device tests against the actual published origin. Investigate failures rather than treating the local rule results as proof of deployment success.

The first release still needs those checks and player feedback before it is described as contest-ready. Offline practice screenshots establish appearance only, not online multiplayer reliability.
