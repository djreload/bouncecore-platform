import { cpus, freemem, totalmem, uptime } from "node:os";
import { prisma } from "@/lib/db/prisma";
import { getProviderSnapshot } from "@/lib/stream/stream-channel-service";
import { getHlsPlaybackHealth } from "@/lib/stream/hls-playback-health";

type HealthStatus = "healthy" | "warning" | "critical";

type HealthCheck = {
  label: string;
  status: HealthStatus;
  value: string;
  detail: string;
};

function formatBytes(bytes: number) {
  const gib = bytes / 1024 / 1024 / 1024;

  return `${gib.toFixed(1)} GiB`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function envCheck(label: string, key: string): HealthCheck {
  const configured = Boolean(process.env[key]?.trim());

  return {
    label,
    status: configured ? "healthy" : "warning",
    value: configured ? "Configured" : "Missing",
    detail: key
  };
}

function enabled(key: string) {
  return process.env[key]?.trim().toLowerCase() === "true";
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function modeCheck(label: string, active: boolean, detail: string): HealthCheck {
  return {
    detail,
    label,
    status: "healthy",
    value: active ? "Enabled" : "Disabled"
  };
}

function enabledEnvCheck(label: string, key: string, active: boolean): HealthCheck {
  if (!active) {
    return {
      detail: `${key} is required only when TRANSCODER_ENABLED=true`,
      label,
      status: "healthy",
      value: "Optional"
    };
  }

  return envCheck(label, key);
}

function optionalEnvCheck(label: string, key: string): HealthCheck {
  const configured = Boolean(process.env[key]?.trim());

  return {
    detail: key,
    label,
    status: "healthy",
    value: configured ? "Configured" : "Optional"
  };
}

async function databaseCheck(): Promise<HealthCheck> {
  const startedAt = performance.now();

  await prisma.$queryRaw`SELECT 1`;

  return {
    label: "Database",
    status: "healthy",
    value: `${Math.round(performance.now() - startedAt)} ms`,
    detail: "PostgreSQL query responded"
  };
}

export async function getAdminSystemHealthData() {
  const chatCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [databaseResult, streamResult, activeSessions, chatRooms, recentMessages, auditLogs] = await Promise.all([
    databaseCheck().catch<HealthCheck>((error) => ({
      label: "Database",
      status: "critical",
      value: "Unavailable",
      detail: error instanceof Error ? error.message : "PostgreSQL query failed"
    })),
    getProviderSnapshot().catch((error) => ({
      status: "degraded" as const,
      playbackUrl: null,
      viewerCount: 0,
      health: {
        status: "critical" as const,
        checkedAt: new Date().toISOString(),
        ingestConnected: false,
        details: error instanceof Error ? error.message : "Stream provider unavailable"
      }
    })),
    prisma.authSession.count({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    }),
    prisma.chatRoom.count(),
    prisma.chatMessage.count({
      where: {
        createdAt: {
          gte: chatCutoff
        },
        deletedAt: null
      }
    }),
    prisma.auditLog.count()
  ]);
  const memoryTotal = totalmem();
  const memoryFree = freemem();
  const memoryUsedPercent = Math.round(((memoryTotal - memoryFree) / memoryTotal) * 100);
  const transcoderEnabled = enabled("TRANSCODER_ENABLED");
  const playbackUrl = transcoderEnabled
    ? process.env.TRANSCODER_HLS_PUBLIC_URL?.trim() || streamResult.playbackUrl
    : streamResult.playbackUrl ?? process.env.PUBLIC_PLAYBACK_URL?.trim() ?? null;
  const playbackHealthUrl = envValue("HLS_PLAYBACK_HEALTH_URL") || playbackUrl;
  const streamIsActive = streamResult.health.ingestConnected || streamResult.status !== "offline";
  const playbackManifest = await getHlsPlaybackHealth({
    adaptive: transcoderEnabled,
    live: streamIsActive,
    playbackUrl: playbackHealthUrl
  });
  const streamHealthDetail =
    "details" in streamResult.health && typeof streamResult.health.details === "string"
      ? streamResult.health.details
      : `Ingest connected: ${streamResult.health.ingestConnected ? "yes" : "no"}. Checked ${streamResult.health.checkedAt}`;
  const checks: HealthCheck[] = [
    {
      label: "App runtime",
      status: "healthy",
      value: process.env.NODE_ENV ?? "development",
      detail: `Node ${process.version}, uptime ${formatUptime(uptime())}`
    },
    databaseResult,
    {
      label: "Stream provider",
      status: streamResult.health.status === "healthy" ? "healthy" : "warning",
      value: streamResult.status,
      detail: streamHealthDetail
    },
    envCheck("Public app URL", "NEXT_PUBLIC_APP_URL"),
    envCheck("Internal task token", "INTERNAL_TASK_TOKEN"),
    envCheck("Tenor GIF API", "TENOR_API_KEY"),
    envCheck("Push token encryption", "PUSH_TOKEN_ENCRYPTION_KEY"),
    envCheck("PayPal client ID", "PAYPAL_CLIENT_ID"),
    envCheck("PayPal client secret", "PAYPAL_CLIENT_SECRET"),
    envCheck("PayPal webhook ID", "PAYPAL_WEBHOOK_ID"),
    envCheck("RTMP ingest URL", "RTMP_INGEST_URL"),
    envCheck("Stream key validation URL", "STREAM_CORE_KEY_VALIDATION_URL"),
    optionalEnvCheck("Media gateway HLS URL", "MEDIA_GATEWAY_PUBLIC_HLS_URL"),
    modeCheck(
      "Adaptive HLS transcoder",
      transcoderEnabled,
      transcoderEnabled
        ? "FFmpeg adaptive HLS profile is expected to serve a multi-variant master playlist."
        : "Direct HLS remains available; adaptive checks become required when TRANSCODER_ENABLED=true."
    ),
    enabledEnvCheck("Adaptive HLS master URL", "TRANSCODER_HLS_PUBLIC_URL", transcoderEnabled),
    enabledEnvCheck("Transcoder RTMP input", "TRANSCODER_INPUT_URL", transcoderEnabled),
    enabledEnvCheck("HLS origin host port", "TRANSCODER_HLS_BIND_PORT", transcoderEnabled),
    envCheck("Playback URL", "PUBLIC_PLAYBACK_URL"),
    optionalEnvCheck("Playback health URL", "HLS_PLAYBACK_HEALTH_URL"),
    {
      detail: playbackManifest.detail,
      label: "Playback manifest",
      status: playbackManifest.status,
      value: playbackManifest.value
    }
  ];
  const criticalChecks = checks.filter((check) => check.status === "critical").length;
  const warningChecks = checks.filter((check) => check.status === "warning").length;

  return {
    checkedAt: new Date().toISOString(),
    overallStatus: criticalChecks ? "critical" : warningChecks ? "warning" : "healthy",
    checks,
    metrics: [
      {
        label: "Active sessions",
        value: activeSessions.toLocaleString("en-GB"),
        detail: "Valid, unrevoked auth sessions"
      },
      {
        label: "Chat rooms",
        value: chatRooms.toLocaleString("en-GB"),
        detail: `${recentMessages.toLocaleString("en-GB")} visible messages in the last 24 hours`
      },
      {
        label: "Audit events",
        value: auditLogs.toLocaleString("en-GB"),
        detail: "Security and operations records"
      },
      {
        label: "Memory used",
        value: `${memoryUsedPercent}%`,
        detail: `${formatBytes(memoryTotal - memoryFree)} of ${formatBytes(memoryTotal)}`
      },
      {
        label: "CPU cores",
        value: cpus().length.toLocaleString("en-GB"),
        detail: cpus()[0]?.model ?? "Runtime CPU information"
      },
      {
        label: "Viewers",
        value: streamResult.viewerCount.toLocaleString("en-GB"),
        detail: streamResult.playbackUrl ?? "No playback URL reported"
      },
      {
        label: "Playback mode",
        value: transcoderEnabled ? "Adaptive HLS" : "Direct HLS",
        detail: playbackUrl ?? "Provider playback URL"
      },
      {
        label: "HLS variants",
        value: playbackManifest.variantCount ? playbackManifest.variantCount.toLocaleString("en-GB") : "Waiting",
        detail: playbackManifest.detail
      }
    ]
  };
}
