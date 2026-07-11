param(
    [string]$WebUrl = "",
    [string]$KeystorePath = "",
    [string]$CredentialsPath = "",
    [string]$KeyAlias = "",
    [string]$StorePassword = "",
    [string]$KeyPassword = "",
    [int]$VersionCode = 1,
    [string]$VersionName = "1.0.0",
    [string]$LevelPlayAppKey = "",
    [string]$BannerAdUnitId = "",
    [string]$InterstitialAdUnitId = "",
    [string]$FirebaseAndroidApiKey = "",
    [string]$FirebaseAndroidAppId = "",
    [string]$FirebaseMessagingSenderId = "",
    [string]$FirebaseProjectId = "",
    [switch]$Bundle
)

$ErrorActionPreference = "Stop"

function ConvertTo-PlainText {
    param([securestring]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

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

function Import-SigningProperties {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Signing credentials file not found at $Path"
    }

    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1).Trim()
        if ($key) {
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

function Assert-ReleaseWebUrl {
    param([string]$Value)

    if (-not $Value) {
        throw "WebUrl is required for release builds. Use -WebUrl <production-https-url>"
    }

    try {
        $uri = [uri]$Value
    } catch {
        throw "WebUrl must be a valid HTTPS URL."
    }

    if ($uri.Scheme -ne "https" -or -not $uri.Host) {
        throw "WebUrl must be a valid HTTPS URL."
    }

    $hostName = $uri.Host.ToLowerInvariant()
    $isPrivate172 = $hostName -match "^172\.(1[6-9]|2[0-9]|3[0-1])\."
    $isUnsafeHost =
        $hostName -eq "localhost" `
        -or $hostName -eq "127.0.0.1" `
        -or $hostName -eq "::1" `
        -or $hostName.StartsWith("10.") `
        -or $hostName.StartsWith("192.168.") `
        -or $isPrivate172 `
        -or $hostName -eq "your-domain.example" `
        -or $hostName.EndsWith(".example") `
        -or $hostName.StartsWith("develop.") `
        -or $hostName.StartsWith("staging.")

    if ($isUnsafeHost) {
        throw "WebUrl must point to the public production HTTPS site, not a local, placeholder, or staging host."
    }

    return $Value.TrimEnd("/")
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android-webview"
$WebUrl = Assert-ReleaseWebUrl -Value $WebUrl

if (-not $CredentialsPath) {
    $defaultCredentialsPath = Join-Path $androidDir "release\signing.properties"
    if (Test-Path $defaultCredentialsPath) {
        $CredentialsPath = $defaultCredentialsPath
    }
}

if ($CredentialsPath) {
    $CredentialsPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CredentialsPath)
    Import-SigningProperties -Path $CredentialsPath
}

if (-not $KeystorePath) {
    if ($env:BOUNCECORE_RELEASE_STORE_FILE) {
        $KeystorePath = $env:BOUNCECORE_RELEASE_STORE_FILE
    } else {
        $KeystorePath = Join-Path $androidDir "release\bouncecore-release.jks"
    }
}

$KeystorePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($KeystorePath)

if (-not (Test-Path $KeystorePath)) {
    throw "Release keystore not found at $KeystorePath. Run scripts\create-android-release-keystore.ps1 first."
}

if (-not $KeyAlias) {
    $KeyAlias = $env:BOUNCECORE_RELEASE_KEY_ALIAS
}
if (-not $KeyAlias) {
    $KeyAlias = "bouncecore"
}

if (-not $StorePassword) {
    if ($env:BOUNCECORE_RELEASE_STORE_PASSWORD) {
        $StorePassword = $env:BOUNCECORE_RELEASE_STORE_PASSWORD
    } else {
        $StorePassword = ConvertTo-PlainText (Read-Host "Release keystore password" -AsSecureString)
    }
}

if (-not $KeyPassword) {
    if ($env:BOUNCECORE_RELEASE_KEY_PASSWORD) {
        $KeyPassword = $env:BOUNCECORE_RELEASE_KEY_PASSWORD
    } else {
        $KeyPassword = $StorePassword
    }
}

if ($VersionCode -lt 1) {
    throw "VersionCode must be a positive integer."
}

$localAndroidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $javaHome) {
    $env:JAVA_HOME = $javaHome
}

if (Test-Path $localAndroidSdk) {
    $env:ANDROID_SDK_ROOT = $localAndroidSdk
    $env:ANDROID_HOME = $localAndroidSdk
}

$env:ANDROID_USER_HOME = Join-Path $repoRoot ".codex-run\android-home"
$env:GRADLE_USER_HOME = Join-Path $repoRoot ".codex-run\gradle-home"
New-Item -ItemType Directory -Force $env:ANDROID_USER_HOME, $env:GRADLE_USER_HOME | Out-Null

$env:BOUNCECORE_RELEASE_STORE_FILE = $KeystorePath
$env:BOUNCECORE_RELEASE_STORE_PASSWORD = $StorePassword
$env:BOUNCECORE_RELEASE_KEY_ALIAS = $KeyAlias
$env:BOUNCECORE_RELEASE_KEY_PASSWORD = $KeyPassword

$task = if ($Bundle) { "bundleRelease" } else { "assembleRelease" }
$gradleArgs = @(
    "-p", $androidDir,
    "--no-daemon",
    $task,
    "-PBOUNCECORE_WEB_URL=$WebUrl",
    "-PBOUNCECORE_VERSION_CODE=$VersionCode",
    "-PBOUNCECORE_VERSION_NAME=$VersionName"
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

if ($Bundle) {
    $artifact = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
} else {
    $artifact = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
}

if (-not (Test-Path $artifact)) {
    throw "Release artifact was not created at $artifact"
}

Write-Host "Created signed Android release artifact:"
Write-Host "  $artifact"
