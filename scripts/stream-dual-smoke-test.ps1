param(
  [string]$PrimaryStreamKey = $env:STREAM_TEST_KEY,
  [string]$SecondaryStreamKey = $env:STREAM_TEST_KEY_2,
  [string]$ComposeFile = "docker-compose.instance.yml",
  [string]$EnvFile = ".env.instance",
  [string]$DockerNetwork = "bouncecore_default",
  [string]$FfmpegImage = "jrottenberg/ffmpeg:7.1-alpine",
  [string]$RtmpBaseUrl = "rtmp://media-gateway:1935/live",
  [int]$DurationSeconds = 90,
  [int]$HlsTimeoutSeconds = 70,
  [switch]$UseTranscoder
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

function EnvValue($Values, [string]$Key, [string]$Fallback) {
  if ($Values.ContainsKey($Key) -and $Values[$Key]) {
    return [string]$Values[$Key]
  }

  return $Fallback
}

function StreamKeyFingerprint([string]$Key) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Key)
  $hash = $sha256.ComputeHash($bytes)
  $hex = -join ($hash | ForEach-Object { $_.ToString("x2") })

  return $hex.Substring(0, 16)
}

function Encode-PathSegment([string]$Value) {
  return [System.Uri]::EscapeDataString($Value)
}

function RtmpUrlForKey([string]$Key) {
  return "$($RtmpBaseUrl.TrimEnd('/'))/$(Encode-PathSegment $Key)"
}

function DirectHlsUrlForKey([string]$Key) {
  return "http://127.0.0.1:$hlsPort/live/$(Encode-PathSegment $Key)/index.m3u8"
}

function Start-FfmpegPublisher([string]$Name, [string]$Key, [int]$Frequency) {
  $rtmpUrl = RtmpUrlForKey $Key

  Write-Host "Starting $Name publisher at $rtmpUrl"

  & docker run --rm -d --name $Name --network $DockerNetwork $FfmpegImage `
    -hide_banner -loglevel warning `
    -re -f lavfi -i "testsrc2=size=1280x720:rate=30" `
    -re -f lavfi -i "sine=frequency=${Frequency}:sample_rate=48000" `
    -t $DurationSeconds `
    -c:v libx264 -preset veryfast -tune zerolatency `
    -b:v 2600k -maxrate 2600k -bufsize 5200k `
    -g 60 -pix_fmt yuv420p `
    -c:a aac -b:a 128k -ar 48000 `
    -f flv $rtmpUrl
}

function Stop-Publisher([string]$Name) {
  try {
    $runningContainer = & docker ps -q --filter "name=^/$Name$"

    if ($runningContainer) {
      Write-Host "Stopping $Name..."
      & docker stop $Name | Out-Null
    }
  } catch {
    Write-Host "$Name cleanup skipped: $($_.Exception.Message)"
  }
}

function Get-StreamCoreStatus() {
  if (-not $streamCoreToken) {
    Fail "STREAM_CORE_INTERNAL_TOKEN is required in $EnvFile for dual stream status checks."
  }

  $response = Invoke-WebRequest `
    -Uri "http://127.0.0.1:$streamCorePort/api/status" `
    -Headers @{ Authorization = "Bearer $streamCoreToken" } `
    -TimeoutSec 5

  return Decode-ResponseContent $response.Content | ConvertFrom-Json
}

function ActiveIngestsFromStatus($Status) {
  if ($Status.activeIngests) {
    return @($Status.activeIngests)
  }

  if ($Status.playback -and $Status.playback.activeIngests) {
    return @($Status.playback.activeIngests)
  }

  return @()
}

function Wait-ForDualIngests([string]$PrimaryFingerprint, [string]$SecondaryFingerprint) {
  $deadline = (Get-Date).AddSeconds($HlsTimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2

    try {
      $status = Get-StreamCoreStatus
      $ingests = ActiveIngestsFromStatus $status
      $primary = $ingests | Where-Object { $_.role -eq "primary" } | Select-Object -First 1
      $secondary = $ingests | Where-Object { $_.role -eq "secondary" } | Select-Object -First 1

      if (
        $ingests.Count -ge 2 -and
        $primary.streamKeyFingerprint -eq $PrimaryFingerprint -and
        $secondary.streamKeyFingerprint -eq $SecondaryFingerprint
      ) {
        Write-Host "Stream-core reports primary and secondary active ingests."
        return $status
      }
    } catch {
      Write-Host "Waiting for dual ingest status..."
    }
  }

  Fail "Stream-core did not report the expected primary and secondary ingests within $HlsTimeoutSeconds seconds."
}

function Wait-ForPromotedSecondary([string]$SecondaryFingerprint) {
  $deadline = (Get-Date).AddSeconds($HlsTimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2

    try {
      $status = Get-StreamCoreStatus
      $ingests = ActiveIngestsFromStatus $status
      $primary = $ingests | Where-Object { $_.role -eq "primary" } | Select-Object -First 1

      if ($ingests.Count -eq 1 -and $primary.streamKeyFingerprint -eq $SecondaryFingerprint) {
        Write-Host "Secondary publisher was promoted to primary after the first publisher stopped."
        return $status
      }
    } catch {
      Write-Host "Waiting for secondary promotion..."
    }
  }

  Fail "Stream-core did not promote the secondary ingest within $HlsTimeoutSeconds seconds."
}

function Wait-ForHls([string]$Url, [string]$Label, [switch]$RequireVariants) {
  $deadline = (Get-Date).AddSeconds($HlsTimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2

    try {
      $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5
      $playlist = Decode-ResponseContent $response.Content
      $variantCount = [regex]::Matches($playlist, "#EXT-X-STREAM-INF").Count
      $ready = $response.StatusCode -eq 200 -and $playlist.Contains("#EXTM3U")

      if ($RequireVariants) {
        $ready = $ready -and $variantCount -ge 3
      }

      if ($ready) {
        Write-Host "$Label HLS is available: $Url"
        return
      }
    } catch {
      Write-Host "Waiting for $Label HLS..."
    }
  }

  Fail "$Label HLS playlist did not become available at $Url within $HlsTimeoutSeconds seconds."
}

if (-not $PrimaryStreamKey -or -not $SecondaryStreamKey) {
  Fail "Set STREAM_TEST_KEY and STREAM_TEST_KEY_2, or pass -PrimaryStreamKey and -SecondaryStreamKey."
}

if ($PrimaryStreamKey -eq $SecondaryStreamKey) {
  Fail "Primary and secondary stream keys must be different."
}

if (-not (Test-Path -LiteralPath $ComposeFile)) {
  Fail "Missing Compose file: $ComposeFile"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Fail "Missing env file: $EnvFile"
}

$envValues = Read-EnvFile $EnvFile
$hlsPort = EnvValue $envValues "MEDIA_GATEWAY_HLS_BIND_PORT" "18888"
$transcoderHlsPort = EnvValue $envValues "TRANSCODER_HLS_BIND_PORT" "18889"
$streamCorePort = EnvValue $envValues "STREAM_CORE_HTTP_BIND_PORT" "18088"
$streamCoreToken = $envValues.STREAM_CORE_INTERNAL_TOKEN
$primaryFingerprint = StreamKeyFingerprint $PrimaryStreamKey
$secondaryFingerprint = StreamKeyFingerprint $SecondaryStreamKey
$primaryContainer = "bouncecore-ffmpeg-dual-primary-$PID"
$secondaryContainer = "bouncecore-ffmpeg-dual-secondary-$PID"
$primaryHlsUrl = if ($UseTranscoder) { "http://127.0.0.1:$transcoderHlsPort/live/master.m3u8" } else { DirectHlsUrlForKey $PrimaryStreamKey }
$secondaryHlsUrl = DirectHlsUrlForKey $SecondaryStreamKey

if ($UseTranscoder) {
  Write-Host "Starting stream-core, MediaMTX gateway, HLS origin, and FFmpeg transcoder..."
  & docker compose -f $ComposeFile --env-file $EnvFile --profile stream-core --profile media-gateway --profile transcoder up -d stream-core media-gateway hls-origin media-transcoder
} else {
  Write-Host "Starting stream-core and MediaMTX gateway..."
  & docker compose -f $ComposeFile --env-file $EnvFile --profile stream-core --profile media-gateway up -d stream-core media-gateway
}

try {
  $primaryContainerId = Start-FfmpegPublisher $primaryContainer $PrimaryStreamKey 880
  Write-Host "Primary FFmpeg container: $primaryContainerId"
  Start-Sleep -Seconds 4

  $secondaryContainerId = Start-FfmpegPublisher $secondaryContainer $SecondaryStreamKey 1320
  Write-Host "Secondary FFmpeg container: $secondaryContainerId"

  Wait-ForDualIngests $primaryFingerprint $secondaryFingerprint | Out-Null
  Wait-ForHls $primaryHlsUrl "Primary" -RequireVariants:$UseTranscoder
  Wait-ForHls $secondaryHlsUrl "Secondary"

  Stop-Publisher $primaryContainer
  Wait-ForPromotedSecondary $secondaryFingerprint | Out-Null
} finally {
  Stop-Publisher $primaryContainer
  Stop-Publisher $secondaryContainer
}

Write-Host "Dual stream smoke test passed."
