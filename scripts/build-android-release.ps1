param(
    [string]$WebUrl = "https://your-domain.example",
    [string]$KeystorePath = "",
    [string]$CredentialsPath = "",
    [string]$KeyAlias = "",
    [string]$StorePassword = "",
    [string]$KeyPassword = "",
    [int]$VersionCode = 1,
    [string]$VersionName = "1.0.0",
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

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android-webview"

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
