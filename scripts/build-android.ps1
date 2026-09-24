param([string]$ServerUrl = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$toolsRoot = Join-Path $projectRoot '.android-tools'

if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $javaCandidates = @('C:\Program Files\Android\Android Studio\jbr', 'C:\Program Files\Java\jdk-21')
    $javaPath = $javaCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
    if (-not $javaPath) { throw 'Set JAVA_HOME to JDK 17 or newer, or install Android Studio.' }
    $env:JAVA_HOME = $javaPath
}
$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $toolsRoot 'sdk'), "$env:LOCALAPPDATA\Android\Sdk")
$sdkPath = $sdkCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platforms\android-36')) } | Select-Object -First 1
if (-not $sdkPath) { throw 'Install Android SDK Platform 36 and Build Tools 35.0.0. See docs/ANDROID.md.' }
$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$env:GRADLE_USER_HOME = Join-Path $toolsRoot 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $toolsRoot 'user'
$sdkProperty = $sdkPath.Replace('\', '/').Replace(':', '\:')
Set-Content -LiteralPath (Join-Path $androidRoot 'local.properties') -Encoding ascii -Value "sdk.dir=$sdkProperty"

if (-not $ServerUrl) {
    Push-Location $projectRoot
    try { $ServerUrl = (& node --input-type=module -e "import {localNetworkConfig} from './scripts/local-network.mjs'; const a=localNetworkConfig({lan:true,port:8787}).addresses[0]; if(a) console.log('http://'+a+':8787');").Trim() }
    catch { $ServerUrl = '' }
    finally { Pop-Location }
}
if ($ServerUrl -and $ServerUrl -notmatch '^https?://[A-Za-z0-9.\-]+(?::[0-9]+)?/?$') {
    throw 'ServerUrl must be a plain http:// or https:// server origin.'
}

Push-Location $androidRoot
try {
    & '.\gradlew.bat' --no-daemon ":app:assembleDebug" ":app:testDebugUnitTest" ":app:lintDebug" "-PrelayServerUrl=$ServerUrl"
    if ($LASTEXITCODE -ne 0) { throw 'Android build or validation failed.' }
} finally { Pop-Location }

$outputDir = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$apk = Join-Path $outputDir 'echo-relay-android-debug.apk'
Copy-Item -LiteralPath (Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk') -Destination $apk -Force
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$apk.sha256" -Encoding ascii -Value "$hash  echo-relay-android-debug.apk"
Write-Output "APK ready: $apk"
Write-Output "Default Wi-Fi server: $ServerUrl (editable in the app)"
