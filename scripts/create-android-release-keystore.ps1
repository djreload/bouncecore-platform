param(
    [string]$KeystorePath = "",
    [string]$Alias = "bouncecore",
    [string]$CredentialsPath = "",
    [string]$DName = "CN=Bouncecore, OU=Bouncecore, O=Bouncecore, L=London, S=England, C=GB",
    [int]$ValidityDays = 10000,
    [string]$StorePassword = "",
    [string]$KeyPassword = "",
    [switch]$GeneratePasswords
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

function Find-Keytool {
    $candidates = @()

    if ($env:JAVA_HOME) {
        $candidates += (Join-Path $env:JAVA_HOME "bin\keytool.exe")
    }

    $androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    if (Test-Path $androidStudioJbr) {
        $candidates += $androidStudioJbr
    }

    $pathKeytool = Get-Command keytool.exe -ErrorAction SilentlyContinue
    if ($pathKeytool) {
        $candidates += $pathKeytool.Source
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw "keytool.exe was not found. Install Android Studio or set JAVA_HOME to a JDK."
}

function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not $KeystorePath) {
    $KeystorePath = Join-Path $repoRoot "android-webview\release\bouncecore-release.jks"
}

$KeystorePath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($KeystorePath)
$keystoreDir = Split-Path -Parent $KeystorePath
New-Item -ItemType Directory -Force $keystoreDir | Out-Null

if (-not $CredentialsPath) {
    $CredentialsPath = Join-Path $keystoreDir "signing.properties"
}

$CredentialsPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CredentialsPath)
$credentialsDir = Split-Path -Parent $CredentialsPath
New-Item -ItemType Directory -Force $credentialsDir | Out-Null

if (Test-Path $KeystorePath) {
    throw "Keystore already exists at $KeystorePath. Keep it safe and do not overwrite it."
}

if (Test-Path $CredentialsPath) {
    throw "Credentials file already exists at $CredentialsPath. Keep it safe and do not overwrite it."
}

if ($GeneratePasswords) {
    if (-not $StorePassword) {
        $StorePassword = New-RandomSecret
    }

    if (-not $KeyPassword) {
        $KeyPassword = New-RandomSecret
    }
} elseif (-not $StorePassword) {
    $StorePassword = ConvertTo-PlainText (Read-Host "Release keystore password" -AsSecureString)
}

if (-not $KeyPassword) {
    $KeyPassword = $StorePassword
}

if ($StorePassword.Length -lt 6 -or $KeyPassword.Length -lt 6) {
    throw "Android keystore passwords must be at least 6 characters long."
}

$keytool = Find-Keytool

& $keytool `
    -genkeypair `
    -v `
    -keystore $KeystorePath `
    -storetype JKS `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity $ValidityDays `
    -storepass $StorePassword `
    -keypass $KeyPassword `
    -dname $DName

if ($LASTEXITCODE -ne 0) {
    throw "keytool failed with exit code $LASTEXITCODE."
}

$credentials = @(
    "# Bouncecore Android release signing credentials",
    "# Generated on $((Get-Date).ToString("u"))",
    "# Keep this file private and back it up with the keystore.",
    "BOUNCECORE_RELEASE_STORE_FILE=$KeystorePath",
    "BOUNCECORE_RELEASE_KEY_ALIAS=$Alias",
    "BOUNCECORE_RELEASE_STORE_PASSWORD=$StorePassword",
    "BOUNCECORE_RELEASE_KEY_PASSWORD=$KeyPassword"
)

Set-Content -Path $CredentialsPath -Value $credentials -Encoding UTF8

Write-Host "Created Android release keystore:"
Write-Host "  Keystore: $KeystorePath"
Write-Host "  Alias:    $Alias"
Write-Host "  Signing credentials: $CredentialsPath"
Write-Host ""
Write-Host "Back up both files. Losing either means future Play Store updates cannot be signed with the same key."
