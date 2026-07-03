param(
    [string]$WebUrl = "https://bouncecore.co.uk",
    [string]$Serial = "",
    [switch]$LevelPlayTestSuite,
    [string]$LevelPlayAppKey = "",
    [string]$BannerAdUnitId = "",
    [string]$InterstitialAdUnitId = "",
    [string]$FirebaseAndroidApiKey = "",
    [string]$FirebaseAndroidAppId = "",
    [string]$FirebaseMessagingSenderId = "",
    [string]$FirebaseProjectId = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Native {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android-webview"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$localAndroidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adbCandidates = @()
$localAdb = Join-Path $localAndroidSdk "platform-tools\adb.exe"
if (Test-Path $localAdb) {
    $adbCandidates += $localAdb
}
if ($env:ANDROID_SDK_ROOT) {
    $sdkAdb = Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe"
    if (Test-Path $sdkAdb) {
        $adbCandidates += $sdkAdb
    }
}
$pathAdb = Get-Command adb.exe -ErrorAction SilentlyContinue
if ($pathAdb) {
    $adbCandidates += $pathAdb.Source
}

if (-not $adbCandidates) {
    throw "adb.exe was not found. Install Android platform-tools or set ANDROID_SDK_ROOT."
}

$adb = $adbCandidates[0]
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $javaHome) {
    $env:JAVA_HOME = $javaHome
}

$env:ANDROID_SDK_ROOT = $localAndroidSdk
$env:ANDROID_HOME = $localAndroidSdk
$env:ANDROID_USER_HOME = Join-Path $repoRoot ".codex-run\android-home"
$env:GRADLE_USER_HOME = Join-Path $repoRoot ".codex-run\gradle-home"
New-Item -ItemType Directory -Force $env:ANDROID_USER_HOME, $env:GRADLE_USER_HOME | Out-Null

$gradleArgs = @(
    "-p", $androidDir,
    "--no-daemon",
    "assembleDebug",
    "-PBOUNCECORE_DEBUG_WEB_URL=$WebUrl",
    "-PLEVELPLAY_TEST_SUITE_ENABLED=$($LevelPlayTestSuite.IsPresent.ToString().ToLowerInvariant())"
)

if ($LevelPlayAppKey) {
    $gradleArgs += "-PLEVELPLAY_APP_KEY=$LevelPlayAppKey"
}
if ($BannerAdUnitId) {
    $gradleArgs += "-PLEVELPLAY_BANNER_AD_UNIT_ID=$BannerAdUnitId"
}
if ($InterstitialAdUnitId) {
    $gradleArgs += "-PLEVELPLAY_INTERSTITIAL_AD_UNIT_ID=$InterstitialAdUnitId"
}
if ($FirebaseAndroidApiKey) {
    $gradleArgs += "-PFIREBASE_ANDROID_API_KEY=$FirebaseAndroidApiKey"
}
if ($FirebaseAndroidAppId) {
    $gradleArgs += "-PFIREBASE_ANDROID_APP_ID=$FirebaseAndroidAppId"
}
if ($FirebaseMessagingSenderId) {
    $gradleArgs += "-PFIREBASE_MESSAGING_SENDER_ID=$FirebaseMessagingSenderId"
}
if ($FirebaseProjectId) {
    $gradleArgs += "-PFIREBASE_PROJECT_ID=$FirebaseProjectId"
}

Invoke-Native -FilePath (Join-Path $androidDir "gradlew.bat") -Arguments $gradleArgs

if (-not (Test-Path $apkPath)) {
    throw "Debug APK was not created at $apkPath"
}

$deviceLines = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\sdevice$" })
if ($Serial) {
    $targetSerial = $Serial
} elseif ($deviceLines.Count -eq 1) {
    $targetSerial = ($deviceLines[0] -split "\s+")[0]
} elseif ($deviceLines.Count -gt 1) {
    throw "Multiple authorized devices found. Re-run with -Serial <device-serial>."
} else {
    throw "No authorized Android device found. Connect the phone and accept the USB debugging prompt."
}

Invoke-Native -FilePath $adb -Arguments @("-s", $targetSerial, "install", "-r", "-d", $apkPath)
Invoke-Native -FilePath $adb -Arguments @("-s", $targetSerial, "shell", "am", "force-stop", "uk.co.bouncecore.app")
Invoke-Native -FilePath $adb -Arguments @("-s", $targetSerial, "shell", "monkey", "-p", "uk.co.bouncecore.app", "-c", "android.intent.category.LAUNCHER", "1")

Write-Host "Installed and launched Bouncecore on $targetSerial using $WebUrl. LevelPlay test suite: $($LevelPlayTestSuite.IsPresent)"
