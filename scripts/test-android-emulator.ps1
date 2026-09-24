param(
    [string]$Serial = 'emulator-5554',
    [string]$Server = 'http://127.0.0.1:8788',
    [string]$Room = '',
    [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot '.android-tools'
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $toolsRoot 'sdk' }
$adb = Join-Path $sdkRoot 'platform-tools\adb.exe'
if ($Serial -notmatch '^emulator-[0-9]+$') { throw 'This test script targets Android emulators only.' }
if ($Room -and $Room -notmatch '^[A-HJ-NP-Z2-9]{6}$') { throw 'Use a valid six-character relay room code.' }
if ((& $adb -s $Serial get-state 2>$null) -ne 'device') { throw 'Boot the emulator and wait for Android before running this script.' }
if ((& $adb -s $Serial shell getprop sys.boot_completed).Trim() -ne '1') { throw 'Android is still booting.' }
& $adb -s $Serial shell input keyevent KEYCODE_WAKEUP
& $adb -s $Serial shell wm dismiss-keyguard

if (-not $SkipBuild) {
    if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Java\jdk-21' }
    $env:GRADLE_USER_HOME = Join-Path $toolsRoot 'gradle-home'
    $env:ANDROID_USER_HOME = Join-Path $toolsRoot 'user'
    Push-Location (Join-Path $projectRoot 'android')
    try {
        & '.\gradlew.bat' --no-daemon :app:assembleDebug :app:assembleDebugAndroidTest
        if ($LASTEXITCODE -ne 0) { throw 'Instrumentation build failed.' }
    } finally { Pop-Location }
}

& $adb -s $Serial install -r (Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk')
if ($LASTEXITCODE -ne 0) { throw 'App installation failed.' }
& $adb -s $Serial install -r (Join-Path $projectRoot 'android\app\build\outputs\apk\androidTest\debug\app-debug-androidTest.apk')
if ($LASTEXITCODE -ne 0) { throw 'Test package installation failed.' }
# Forward only the localhost test server, preserving its host/origin validation.
& $adb -s $Serial reverse tcp:8788 tcp:8788
& $adb -s $Serial shell settings put global window_animation_scale 0
& $adb -s $Serial shell settings put global transition_animation_scale 0
& $adb -s $Serial shell settings put global animator_duration_scale 0

$evidenceRoot = Join-Path $projectRoot 'test-results\android'
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$testClass = 'com.echorelay.game.GameJourneyTest'
$caseName = if ($Room) { 'online' } else { 'offline-and-recovery' }
$selection = if ($Room) { "$testClass#onlineFutureWithBrowserPartner" } else { "$testClass#offlineAllChambersWithLifecycleAndReplay,$testClass#invalidAddressAndConnectionRecovery" }
$arguments = @('-s', $Serial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'class', $selection)
if ($Room) { $arguments += @('-e', 'relayRoom', $Room, '-e', 'relayServer', $Server) }
$arguments += 'com.echorelay.game.debug.test/androidx.test.runner.AndroidJUnitRunner'
$logPath = Join-Path $evidenceRoot "$caseName.txt"
& $adb @arguments | Tee-Object -FilePath $logPath
& $adb -s $Serial pull '/sdcard/Android/data/com.echorelay.game.debug/files/e2e' $evidenceRoot
$crashLines = @(& $adb -s $Serial logcat -d -b crash)
if ($LASTEXITCODE -ne 0) { throw 'Could not collect the emulator crash log.' }
[System.IO.File]::WriteAllText((Join-Path $evidenceRoot "$caseName-crashes.txt"), ($crashLines -join [Environment]::NewLine))
$logText = Get-Content -LiteralPath $logPath -Raw
if ($logText -notmatch 'OK \([1-9][0-9]* tests?\)' -or $logText -match 'FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed') {
    throw "Android instrumentation did not pass. Inspect $logPath"
}
Write-Output "Android $caseName tests passed. Evidence: $evidenceRoot"
