param(
  [string]$UserEmail = $env:STREAM_SMOKE_USER_EMAIL,
  [string]$ComposeFile = "docker-compose.instance.yml",
  [string]$EnvFile = ".env.instance",
  [string]$DockerNetwork = "bouncecore_default",
  [int]$DurationSeconds = 45,
  [int]$HlsTimeoutSeconds = 35,
  [switch]$UseTranscoder,
  [switch]$SkipAppStart
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Read-EnvFile([string]$Path) {
  $values = @{}

  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()

    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function EnvValue($Values, [string]$Key, [string]$Fallback) {
  if ($Values.ContainsKey($Key) -and $Values[$Key]) {
    return [string]$Values[$Key]
  }

  return $Fallback
}

function DatabaseUrlForHost($Values) {
  $hostName = EnvValue $Values "POSTGRES_BIND_HOST" "127.0.0.1"
  $port = EnvValue $Values "POSTGRES_PORT" "5432"
  $database = EnvValue $Values "POSTGRES_DB" "bouncecore_platform"
  $user = EnvValue $Values "POSTGRES_USER" "bouncecore_app"
  $password = EnvValue $Values "POSTGRES_PASSWORD" ""

  if (-not $password) {
    Fail "POSTGRES_PASSWORD is required in $EnvFile."
  }

  $encodedUser = [System.Uri]::EscapeDataString($user)
  $encodedPassword = [System.Uri]::EscapeDataString($password)
  $encodedDatabase = [System.Uri]::EscapeDataString($database)

  return "postgresql://${encodedUser}:${encodedPassword}@${hostName}:${port}/${encodedDatabase}"
}

function Wait-ForAppHealth([string]$Url) {
  $deadline = (Get-Date).AddSeconds(90)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5

      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  Fail "App health check did not become ready at $Url."
}

if (-not $UserEmail) {
  Fail "Set STREAM_SMOKE_USER_EMAIL or pass -UserEmail."
}

if (-not (Test-Path -LiteralPath $ComposeFile)) {
  Fail "Missing Compose file: $ComposeFile"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Fail "Missing env file: $EnvFile"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..")
$nodeHelper = Join-Path $scriptRoot "temp-stream-key.mjs"
$smokeScript = Join-Path $scriptRoot "stream-smoke-test.ps1"
$envValues = Read-EnvFile $EnvFile
$appHost = EnvValue $envValues "APP_BIND_HOST" "127.0.0.1"
$appPort = EnvValue $envValues "APP_PORT" "3000"
$appHealthUrl = "http://${appHost}:${appPort}/api/health"
$previousDatabaseUrl = $env:DATABASE_URL
$tempKey = $null

Push-Location $repoRoot
try {
  if (-not $SkipAppStart) {
    Write-Host "Starting app dependencies for stream smoke test..."
    & docker compose -f $ComposeFile --env-file $EnvFile up -d postgres redis app

    if ($LASTEXITCODE -ne 0) {
      Fail "Docker Compose could not start the app dependencies."
    }

    Wait-ForAppHealth $appHealthUrl
  }

  $env:DATABASE_URL = DatabaseUrlForHost $envValues
  $keyJson = & node $nodeHelper create --email $UserEmail

  if ($LASTEXITCODE -ne 0) {
    Fail "Temporary stream key creation failed."
  }

  $tempKey = $keyJson | ConvertFrom-Json
  Write-Host "Temporary stream key created: $($tempKey.fingerprint)"

  $smokeArgs = @(
    "-StreamKey", $tempKey.rawKey,
    "-ComposeFile", $ComposeFile,
    "-EnvFile", $EnvFile,
    "-DockerNetwork", $DockerNetwork,
    "-DurationSeconds", $DurationSeconds,
    "-HlsTimeoutSeconds", $HlsTimeoutSeconds
  )

  if ($UseTranscoder) {
    $smokeArgs += "-UseTranscoder"
  }

  & powershell -ExecutionPolicy Bypass -File $smokeScript @smokeArgs

  if ($LASTEXITCODE -ne 0) {
    Fail "Stream smoke test failed."
  }
} finally {
  if ($tempKey -and $tempKey.keyId) {
    try {
      $revokeJson = & node $nodeHelper revoke --key-id $tempKey.keyId
      $revoke = $revokeJson | ConvertFrom-Json

      if ($revoke.revoked) {
        Write-Host "Temporary stream key revoked: $($revoke.fingerprint)"
      }
    } catch {
      Write-Host "Temporary stream key cleanup failed: $($_.Exception.Message)"
    }
  }

  $env:DATABASE_URL = $previousDatabaseUrl
  Pop-Location
}
