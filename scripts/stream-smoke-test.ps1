param(
  [string]$StreamKey = $env:STREAM_TEST_KEY,
  [string]$ComposeFile = "docker-compose.instance.yml",
  [string]$EnvFile = ".env.instance",
  [string]$DockerNetwork = "bouncecore_default",
  [string]$FfmpegImage = "jrottenberg/ffmpeg:7.1-alpine",
  [string]$RtmpUrl = "",
  [string]$HlsUrl = "",
  [int]$DurationSeconds = 45,
  [int]$HlsTimeoutSeconds = 35
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

function Decode-ResponseContent($Content) {
  if ($Content -is [byte[]]) {
    return [System.Text.Encoding]::UTF8.GetString($Content)
  }

  return [string]$Content
}

if (-not $StreamKey) {
  Fail "Set STREAM_TEST_KEY or pass -StreamKey with a local active Bouncecore stream key."
}

if (-not (Test-Path -LiteralPath $ComposeFile)) {
  Fail "Missing Compose file: $ComposeFile"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Fail "Missing env file: $EnvFile"
}

$envValues = Read-EnvFile $EnvFile
$hlsPort = if ($envValues.MEDIA_GATEWAY_HLS_BIND_PORT) { $envValues.MEDIA_GATEWAY_HLS_BIND_PORT } else { "18888" }
$streamCorePort = if ($envValues.STREAM_CORE_HTTP_BIND_PORT) { $envValues.STREAM_CORE_HTTP_BIND_PORT } else { "18088" }
$streamCoreToken = $envValues.STREAM_CORE_INTERNAL_TOKEN

if (-not $RtmpUrl) {
  $encodedKey = [System.Uri]::EscapeDataString($StreamKey)
  $RtmpUrl = "rtmp://media-gateway:1935/live?user=bouncecore&pass=$encodedKey"
}

if (-not $HlsUrl) {
  $HlsUrl = "http://127.0.0.1:$hlsPort/live/index.m3u8"
}

$containerName = "bouncecore-ffmpeg-smoke-$PID"
$passed = $false

Write-Host "Starting stream-core and MediaMTX gateway..."
& docker compose -f $ComposeFile --env-file $EnvFile --profile stream-core --profile media-gateway up -d stream-core media-gateway

try {
  Write-Host "Starting disposable FFmpeg container..."
  $containerId = & docker run --rm -d --name $containerName --network $DockerNetwork $FfmpegImage `
    -hide_banner -loglevel warning `
    -re -f lavfi -i "testsrc=size=1280x720:rate=30" `
    -re -f lavfi -i "sine=frequency=1000:sample_rate=48000" `
    -t $DurationSeconds `
    -c:v libx264 -preset veryfast -tune zerolatency `
    -b:v 3000k -maxrate 3000k -bufsize 6000k `
    -g 60 -pix_fmt yuv420p `
    -c:a aac -b:a 160k -ar 48000 `
    -f flv $RtmpUrl

  Write-Host "FFmpeg container: $containerId"
  Write-Host "Polling HLS playlist: $HlsUrl"

  $deadline = (Get-Date).AddSeconds($HlsTimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2

    try {
      $response = Invoke-WebRequest -Uri $HlsUrl -Method GET -TimeoutSec 5
      $playlist = Decode-ResponseContent $response.Content

      if ($response.StatusCode -eq 200 -and $playlist.Contains("#EXTM3U")) {
        Write-Host "HLS playlist is available."
        Write-Host ($playlist.Split("`n") | Select-Object -First 8 | Out-String).Trim()
        $passed = $true
        break
      }
    } catch {
      Write-Host "Waiting for HLS..."
    }
  }

  if (-not $passed) {
    Fail "HLS playlist did not become available within $HlsTimeoutSeconds seconds."
  }

  if ($streamCoreToken) {
    $status = Invoke-WebRequest -Uri "http://127.0.0.1:$streamCorePort/api/status" -Headers @{ Authorization = "Bearer $streamCoreToken" } -TimeoutSec 5
    Write-Host "Stream-core status:"
    Write-Host (Decode-ResponseContent $status.Content)
  }
} finally {
  try {
    $runningContainer = & docker ps -q --filter "name=^/$containerName$"

    if ($runningContainer) {
      Write-Host "Stopping disposable FFmpeg container..."
      & docker stop $containerName | Out-Null
    }
  } catch {
    Write-Host "FFmpeg container cleanup skipped: $($_.Exception.Message)"
  }
}

Write-Host "Stream smoke test passed."
