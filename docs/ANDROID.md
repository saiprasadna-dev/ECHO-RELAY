# ECHO RELAY for Android

The Android app uses a native launcher and Android System WebView to run the same cinematic game as the browser. Environment artwork, traveller sprites, scripts, styles and puzzle rules are bundled for offline practice. Multiplayer loads the selected game server in its own origin, preserving the existing HTTP-only cookies, origin checks and WebSocket protocol. Android and browser players can share a relay.

## Install the test APK

Build output: `dist/echo-relay-android-debug.apk` (Android 8.0 / API 26 or newer).

1. With the Wi-Fi test server running, open its address with `/android.apk` on each phone to download the APK (for example `http://192.168.1.10:8787/android.apk`). Alternatively, copy `dist/echo-relay-android-debug.apk` to each phone using USB.
2. Open the APK on the phone and allow installation from that file manager if Android asks.
3. Open **ECHO RELAY**. **Explore solo offline** works immediately without a computer or internet connection.
4. For multiplayer, connect both phones and the computer to the same private Wi-Fi. Keep the local server running. Enter the same computer server address on both phones and tap **Connect to the relay**.
5. One player creates a relay. The other joins its six-character code. Both select **Ready to begin**.

During play, follow **Your next move** above the scene. **Easy guide** starts enabled: tap its location button, let your traveller arrive, then use the suggested action. The guide says when it is your partner's turn. **Level walkthrough** explains the whole current level; **Share clue** sends a discovered clue to your partner. In solo practice, use **Now play Past/Future** when prompted.

The debug application ID is `com.echorelay.game.debug`. The APK is signed with a development key, suitable for local installation and testing; it is not a Play Store release.

## Start a Wi-Fi server

```powershell
npm run start:lan
```

The terminal prints the actual private IPv4 address to enter in Android, such as `http://192.168.1.10:8787`. Do not use `127.0.0.1` on a phone: it refers to the phone itself. Both players must use the same server. The address can change when the computer reconnects to Wi-Fi.

During the initial Android handoff, a separate server runs on **port 8788**, preserving the existing browser session on 8787:

```powershell
$env:PORT = '8788'
$env:RELAY_DATA_DIR = '.local-data-android'
npm run start:lan
```

The two servers use separate room saves. Create a new room for the Android test; a room on port 8787 is not present on port 8788.

If Android creates a room that the laptop cannot find, compare the complete server addresses, including the port. For this setup, the laptop must open port **8788**, matching Android. Use the full invitation shown below the room code. A six-character code does not identify which server hosts it. The laptop can use `http://127.0.0.1:8788`; a physical phone must use the computer's Wi-Fi address on that same port. Returning players should keep using the hostname where they joined so their saved session remains available.

If connection fails, first open the printed address in the phone's browser. Check that the computer server is running, Wi-Fi guest/client isolation is off, and Windows Firewall allows Node.js on the private network. Do not forward the development port to the internet. `npm start` still binds only to loopback; Wi-Fi access is explicitly enabled by `--lan` and accepts only this computer's private IPv4 host addresses.

## Build on Windows

Requirements:

- Node.js 22.12+ for the game server.
- JDK 17 or newer (this build uses the installed JDK 21).
- Android SDK Platform 36, Build Tools 35.0.0 and Platform Tools.
- Internet access for the first Gradle/dependency download.

Install SDK packages through Android Studio's SDK Manager, or the official command-line SDK tools. The Gradle wrapper is pinned to 8.13 with its distribution SHA-256. The Android Gradle Plugin is pinned to 8.13.2; AndroidX WebKit is pinned to 1.14.0. Local tool downloads and signing material are ignored by Git.

```powershell
npm run android:build
# Or choose the default server address embedded in the launcher:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -ServerUrl 'http://192.168.1.10:8788'
```

The script runs `assembleDebug`, JVM unit tests and Android lint, then copies the APK and its SHA-256 to `dist/`. The address remains editable on each phone. Without an explicit address, the script uses the first private IPv4 interface and port 8787; check the printed address if the computer has multiple adapters.

On any supported OS with Java and Android SDK configured:

```sh
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

The Gradle `syncGameAssets` task refreshes bundled assets from `public/` on each build and marks the packaged page as offline-only. Do not edit generated files in `android/app/build/`.

## Native behavior

- The offline button opens practice directly; its home screen does not offer unusable online room controls.
- The native Menu/back action confirms before leaving a run. Online progress remains on the server and can be resumed with the same app's private session cookie.
- Rotating the phone preserves the current WebView. Background/resume retains the view when Android keeps the process alive. If Android kills the process, online play reconnects to the saved room URL; offline practice restarts because its state lives in memory.
- Insets account for system bars, display cutouts and the keyboard. Sound remains opt-in.
- Server errors show retry and menu actions. TLS errors are never bypassed. Navigation and resources are restricted to the selected origin. No native JavaScript bridge, file access, third-party cookies, analytics or advertising SDK is enabled.
- Debug builds allow HTTP only for numeric private IPv4/loopback server addresses (and localhost). Release builds require HTTPS. Only the INTERNET Android permission is requested.

## Emulator end-to-end tests

The `GameJourneyTest` Android instrumentation suite drives the installed application's native controls and its real WebView with Espresso and UI Automator. It does not invoke the game rules directly. The suite covers walking to objects, hidden controls until arrival, all six destinations, private clue reading, the portal, canal and storm puzzles, the shared reunion, replay, rotation/background changes, Android back confirmation, invalid server input, connection failure/retry and return to offline play. A separate multiplayer test plays Future with a real browser partner, including a wrong-state anchor, activity recreation and rejoining the saved checkpoint.

Install the official Android emulator and `system-images;android-36;google_apis;x86_64` through SDK Manager, create a virtual phone and boot it. Windows needs a supported emulator hypervisor. The project-local virtual device prepared during development is named `ECHO_API36`; its files live under `.android-tools/avd/`.

With the emulator running:

```powershell
npm run android:test
```

The script builds and installs the app and test APK, forwards port 8788 through ADB, runs the offline/recovery cases and collects screenshots, instrumentation output and crash logs under `test-results/android/`. It rejects non-emulator device IDs so the test runner does not install onto a connected personal phone inadvertently.

For the multiplayer case, start the development server on port 8788 and create a room in a separate browser. The browser player takes Past and readies up. Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-android-emulator.ps1 -SkipBuild -Room ABC234
```

Replace `ABC234` with a newly created room code. Walk to the relevant objects and follow Android's chat messages: grow, drain after anchoring, install the bearing, route power to Lift, match the constellation, route light to Portal and send the pulse. Then set the safe tide, release the anchored boat, aim the storm beacon, open the sky route after anchoring, and walk to the reunion circle on both devices. Test messages and assertions come from the visible UI. Each partner action has a 90-second test timeout.

Existing three-chamber rooms retain their saved rules. Create a new room for the walking adventure. Update the APK to get the six-destination offline practice; online play loads the current game from the server.

On September 24, 2026, all three instrumentation cases passed on the Android 16 emulator, including the complete browser/Android multiplayer ending. See [TESTING.md](TESTING.md) for the environment, evidence and remaining physical-phone checks.

## Release distribution

The source includes a release variant, but publishing requires a deployed HTTPS game server and a private release signing key. Configure those for the owner's account, then build a signed AAB in Android Studio or Gradle. No Play Console submission or hosting deployment is performed by this Android build.

## References

- [Android's local WebView content guidance](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content) — asset loading through a secure origin.
- [Android Gradle Plugin 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes) — pinned build tool requirements.
- [AndroidX WebKit release notes](https://developer.android.com/jetpack/androidx/releases/webkit) — the packaged WebView helper library.

See [TESTING.md](TESTING.md) for checks actually run and remaining phone validation.
