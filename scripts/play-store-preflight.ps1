param(
    [string]$WebUrl = "",
    [string]$ArtifactPath = "",
    [string]$ExpectedPackageName = "uk.co.bouncecore.app",
    [int]$PreviousVersionCode = 0,
    [switch]$AllowApk,
    [switch]$AllowStaging,
    [switch]$SkipArtifact,
    [switch]$SkipNetwork
)

$ErrorActionPreference = "Stop"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
    # Older PowerShell hosts can continue with their default protocol set.
}

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    $script:checks.Add([pscustomobject]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    }) | Out-Null
}

function Fail-Check {
    param(
        [string]$Name,
        [string]$Detail
    )

    Add-Check -Name $Name -Passed $false -Detail $Detail
}

function Pass-Check {
    param(
        [string]$Name,
        [string]$Detail
    )

    Add-Check -Name $Name -Passed $true -Detail $Detail
}

function Assert-ProductionHttpsUrl {
    param(
        [string]$Value,
        [bool]$AllowStagingHost = $false
    )

    if (-not $Value) {
        throw "WebUrl is required. Use -WebUrl <production-https-url>."
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
    $isStagingHost = $hostName.StartsWith("develop.") -or $hostName.StartsWith("staging.")
    $isUnsafeHost =
        $hostName -eq "localhost" `
        -or $hostName -eq "127.0.0.1" `
        -or $hostName -eq "::1" `
        -or $hostName.StartsWith("10.") `
        -or $hostName.StartsWith("192.168.") `
        -or $isPrivate172 `
        -or $hostName -eq "your-domain.example" `
        -or $hostName.EndsWith(".example") `
        -or $isStagingHost

    if ($isUnsafeHost -and -not ($AllowStagingHost -and $isStagingHost)) {
        throw "WebUrl must point to the public production HTTPS site, not a local, placeholder, or staging host."
    }

    return $Value.TrimEnd("/")
}

function Read-TextFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Missing file: $Path"
    }

    Get-Content -Path $Path -Raw
}

function First-RegexGroup {
    param(
        [string]$Text,
        [string]$Pattern
    )

    $match = [regex]::Match($Text, $Pattern)
    if (-not $match.Success) {
        return ""
    }

    $match.Groups[1].Value
}

function Get-ArtifactMetadata {
    param([string]$Path)

    $artifactDir = Split-Path -Parent $Path
    $metadataPath = Join-Path $artifactDir "output-metadata.json"
    if (-not (Test-Path $metadataPath)) {
        return $null
    }

    Get-Content -Path $metadataPath -Raw | ConvertFrom-Json
}

function Invoke-JsonGet {
    param([string]$Url)

    [string](Invoke-TextGet -Url $Url -Accept "application/json").Content | ConvertFrom-Json
}

function Invoke-TextGet {
    param(
        [string]$Url,
        [string]$Accept = "text/plain,text/html,*/*"
    )

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) {
        $node = Get-Command node -ErrorAction SilentlyContinue
    }

    if ($node) {
        $nodeScript = @'
const url = process.argv[1];
const accept = process.argv[2];
fetch(url, { headers: { Accept: accept } })
  .then(async (response) => {
    if (!response.ok) {
      console.error(`HTTP ${response.status}`);
      process.exit(22);
    }
    process.stdout.write(await response.text());
  })
  .catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  });
'@
        $content = & $node.Source -e $nodeScript $Url $Accept
        if ($LASTEXITCODE -ne 0) {
            throw "node fetch failed with exit code $LASTEXITCODE for $Url."
        }

        return [pscustomobject]@{
            StatusCode = 200
            Content = [string]::Join("`n", $content)
        }
    }

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $content = & $curl.Source -fsSL --noproxy "*" --max-time 20 -H "Accept: $Accept" $Url
        if ($LASTEXITCODE -ne 0) {
            throw "curl.exe failed with exit code $LASTEXITCODE for $Url."
        }

        return [pscustomobject]@{
            StatusCode = 200
            Content = [string]::Join("`n", $content)
        }
    }

    $response = Invoke-WebRequest -Uri $Url -Headers @{ Accept = $Accept } -TimeoutSec 20 -UseBasicParsing
    return [pscustomobject]@{
        StatusCode = [int]$response.StatusCode
        Content = [string]$response.Content
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android-webview"
$buildGradlePath = Join-Path $androidDir "app\build.gradle"
$manifestPath = Join-Path $androidDir "app\src\main\AndroidManifest.xml"
$localAppAdsPath = Join-Path $repoRoot "public\app-ads.txt"

try {
    $WebUrl = Assert-ProductionHttpsUrl -Value $WebUrl -AllowStagingHost ([bool]$AllowStaging)
    $checkedHost = ([uri]$WebUrl).Host.ToLowerInvariant()
    $urlLabel = if ($AllowStaging -and ($checkedHost.StartsWith("develop.") -or $checkedHost.StartsWith("staging."))) { "Staging Web URL" } else { "Production Web URL" }
    Pass-Check -Name $urlLabel -Detail $WebUrl
} catch {
    Fail-Check -Name "Production Web URL" -Detail $_.Exception.Message
}

try {
    $buildGradle = Read-TextFile -Path $buildGradlePath
    $applicationId = First-RegexGroup -Text $buildGradle -Pattern 'applicationId\s+"([^"]+)"'
    $versionCodeDefault = First-RegexGroup -Text $buildGradle -Pattern 'BOUNCECORE_VERSION_CODE",\s*"(\d+)"'
    $versionNameDefault = First-RegexGroup -Text $buildGradle -Pattern 'BOUNCECORE_VERSION_NAME",\s*"([^"]+)"'
    $targetSdk = First-RegexGroup -Text $buildGradle -Pattern 'targetSdk\s+(\d+)'
    $minSdk = First-RegexGroup -Text $buildGradle -Pattern 'minSdk\s+(\d+)'

    if ($applicationId -eq $ExpectedPackageName) {
        Pass-Check -Name "Android package name" -Detail $applicationId
    } else {
        Fail-Check -Name "Android package name" -Detail "Expected $ExpectedPackageName, found $applicationId."
    }

    if ([int]$targetSdk -ge 35) {
        Pass-Check -Name "Target SDK" -Detail "targetSdk $targetSdk"
    } else {
        Fail-Check -Name "Target SDK" -Detail "targetSdk $targetSdk is below current Play target expectations."
    }

    if ([int]$minSdk -ge 23) {
        Pass-Check -Name "Minimum SDK" -Detail "minSdk $minSdk"
    } else {
        Fail-Check -Name "Minimum SDK" -Detail "minSdk $minSdk is lower than expected."
    }

    Pass-Check -Name "Default app version" -Detail "versionCode $versionCodeDefault / versionName $versionNameDefault"
} catch {
    Fail-Check -Name "Gradle config" -Detail $_.Exception.Message
}

try {
    [xml]$manifest = Read-TextFile -Path $manifestPath
    $usesCleartext = $manifest.manifest.application.usesCleartextTraffic
    $manifestText = Read-TextFile -Path $manifestPath
    $requiredPermissions = @(
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.POST_NOTIFICATIONS",
        "com.google.android.gms.permission.AD_ID"
    )
    $missingPermissions = @()

    foreach ($permission in $requiredPermissions) {
        if ($manifestText -notmatch [regex]::Escape($permission)) {
            $missingPermissions += $permission
        }
    }

    if ($missingPermissions.Count -eq 0) {
        Pass-Check -Name "Manifest permissions" -Detail "Required app, push, and ads permissions declared."
    } else {
        Fail-Check -Name "Manifest permissions" -Detail "Missing: $($missingPermissions -join ', ')"
    }

    if ($usesCleartext -eq "false") {
        Pass-Check -Name "Cleartext traffic" -Detail "android:usesCleartextTraffic=false"
    } else {
        Fail-Check -Name "Cleartext traffic" -Detail "Release app must not allow cleartext traffic."
    }
} catch {
    Fail-Check -Name "Manifest" -Detail $_.Exception.Message
}

try {
    $localAppAds = Read-TextFile -Path $localAppAdsPath
    if ($localAppAds -match '(?im)^\s*unity\.com\s*,') {
        Pass-Check -Name "Local app-ads.txt" -Detail "Contains Unity seller entry."
    } else {
        Fail-Check -Name "Local app-ads.txt" -Detail "Missing Unity seller entry."
    }
} catch {
    Fail-Check -Name "Local app-ads.txt" -Detail $_.Exception.Message
}

if (-not $SkipArtifact) {
    try {
        if (-not $ArtifactPath) {
            $defaultBundle = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
            $defaultApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
            if (Test-Path $defaultBundle) {
                $ArtifactPath = $defaultBundle
            } elseif ($AllowApk -and (Test-Path $defaultApk)) {
                $ArtifactPath = $defaultApk
            } else {
                $ArtifactPath = $defaultBundle
            }
        }

        $ArtifactPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ArtifactPath)
        if (-not (Test-Path $ArtifactPath)) {
            throw "Release artifact not found at $ArtifactPath. Build one first with scripts\build-android-release.ps1 -Bundle."
        }

        $artifact = Get-Item $ArtifactPath
        $extension = $artifact.Extension.ToLowerInvariant()
        if ($extension -ne ".aab" -and -not ($AllowApk -and $extension -eq ".apk")) {
            throw "Play Store upload should be an .aab. Pass -AllowApk only for direct APK testing."
        }

        if ($artifact.Length -lt 1MB) {
            throw "Artifact is unexpectedly small: $([math]::Round($artifact.Length / 1KB, 1)) KB."
        }

        $metadata = Get-ArtifactMetadata -Path $ArtifactPath
        if ($metadata) {
            $metadataPackage = [string]$metadata.applicationId
            $element = $metadata.elements | Select-Object -First 1
            $artifactVersionCode = [int]$element.versionCode
            $artifactVersionName = [string]$element.versionName

            if ($metadataPackage -and $metadataPackage -ne $ExpectedPackageName) {
                throw "Artifact package is $metadataPackage, expected $ExpectedPackageName."
            }

            if ($artifactVersionCode -le $PreviousVersionCode) {
                throw "Artifact versionCode $artifactVersionCode must be greater than previous Play versionCode $PreviousVersionCode."
            }

            Pass-Check -Name "Release artifact" -Detail "$($artifact.Name), versionCode $artifactVersionCode, versionName $artifactVersionName, $([math]::Round($artifact.Length / 1MB, 1)) MB."
        } else {
            Pass-Check -Name "Release artifact" -Detail "$($artifact.Name), $([math]::Round($artifact.Length / 1MB, 1)) MB. Metadata file not found, package/version not verified."
        }
    } catch {
        Fail-Check -Name "Release artifact" -Detail $_.Exception.Message
    }
} else {
    Pass-Check -Name "Release artifact" -Detail "Skipped by -SkipArtifact."
}

if (-not $SkipNetwork -and $WebUrl) {
    try {
        $privacy = Invoke-TextGet -Url "$WebUrl/privacy"
        if ($privacy.StatusCode -eq 200 -and $privacy.Content -match '(?i)privacy') {
            Pass-Check -Name "Privacy policy URL" -Detail "$WebUrl/privacy returned HTTP 200."
        } else {
            Fail-Check -Name "Privacy policy URL" -Detail "$WebUrl/privacy did not return a recognizable privacy page."
        }
    } catch {
        Fail-Check -Name "Privacy policy URL" -Detail $_.Exception.Message
    }

    try {
        $deletion = Invoke-TextGet -Url "$WebUrl/account/delete"
        if ($deletion.StatusCode -eq 200 -and $deletion.Content -match '(?i)account deletion|deletion request') {
            Pass-Check -Name "Account deletion URL" -Detail "$WebUrl/account/delete returned HTTP 200."
        } else {
            Fail-Check -Name "Account deletion URL" -Detail "$WebUrl/account/delete did not return a recognizable deletion page."
        }
    } catch {
        Fail-Check -Name "Account deletion URL" -Detail $_.Exception.Message
    }

    try {
        $appAds = Invoke-TextGet -Url "$WebUrl/app-ads.txt"
        if ($appAds.StatusCode -eq 200 -and $appAds.Content -match '(?im)^\s*unity\.com\s*,') {
            Pass-Check -Name "Public app-ads.txt" -Detail "$WebUrl/app-ads.txt returned Unity seller entry."
        } else {
            Fail-Check -Name "Public app-ads.txt" -Detail "$WebUrl/app-ads.txt missing Unity seller entry."
        }
    } catch {
        Fail-Check -Name "Public app-ads.txt" -Detail $_.Exception.Message
    }

    try {
        $config = Invoke-JsonGet -Url "$WebUrl/api/mobile/v1/config"
        if ($config.app -and $config.apiVersion -eq "mobile-v1" -and $null -ne $config.version.minimumSupportedVersionCode) {
            Pass-Check -Name "Mobile config API" -Detail "App '$($config.app)', minimum Android build $($config.version.minimumSupportedVersionCode)."
        } else {
            Fail-Check -Name "Mobile config API" -Detail "Config response did not include expected app/version fields."
        }
    } catch {
        Fail-Check -Name "Mobile config API" -Detail $_.Exception.Message
    }
} elseif ($SkipNetwork) {
    Pass-Check -Name "Network checks" -Detail "Skipped by -SkipNetwork."
}

$failed = @($checks | Where-Object { -not $_.passed })

Write-Host "Bouncecore Play Store preflight"
Write-Host "Target: $WebUrl"
Write-Host "Package: $ExpectedPackageName"
Write-Host ""

foreach ($check in $checks) {
    $prefix = if ($check.passed) { "[ok]" } else { "[fail]" }
    Write-Host "$prefix $($check.name): $($check.detail)"
}

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "Result: failed ($($failed.Count) issue$(if ($failed.Count -eq 1) { '' } else { 's' }))"
    exit 1
}

Write-Host "Result: ready"
