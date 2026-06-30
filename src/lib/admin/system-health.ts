import { cpus, freemem, totalmem, uptime } from "node:os";
import { prisma } from "@/lib/db/prisma";
import { mailIsConfigured } from "@/lib/mail/smtp-service";
import { getAdminMobileConfigData } from "@/lib/admin/mobile-service";
import { getAdminSiteSettingsData } from "@/lib/admin/site-settings-service";
import { getPayPalIntegrationData, type PayPalIntegrationData } from "@/lib/payments/paypal-service";
import { defaultStreamOfflineImageUrl, getProviderSnapshot } from "@/lib/stream/stream-channel-service";
import { getHlsPlaybackHealth } from "@/lib/stream/hls-playback-health";
import { getLatestWorkerHeartbeat, getWorkerHeartbeatStatus } from "@/lib/workers/worker-heartbeat";

export type HealthStatus = "healthy" | "warning" | "critical";

export type HealthCheck = {
  label: string;
  status: HealthStatus;
  value: string;
  detail: string;
  href?: string;
};

export type ProductionReadinessGroup = {
  description: string;
  id: string;
  items: HealthCheck[];
  status: HealthStatus;
  title: string;
};

export type ProductionReadinessIssue = HealthCheck & {
  groupId: string;
  groupTitle: string;
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

const productionReadinessRepairLinks: Record<string, string> = {
  "Payment rail": "/admin/payments",
  "PayPal client ID": "/admin/payments",
  "PayPal client secret": "/admin/payments",
  "PayPal webhook ID": "/admin/payments",
  "PayPal webhooks": "/admin/payments",
  "Brevo SMTP": "/admin/integrations",
  "Site support email": "/admin/settings",
  "Site config source": "/admin/settings",
  "Push token encryption": "/admin/push",
  "Mobile android push": "/admin/mobile",
  "Mobile config source": "/admin/mobile",
  "Mobile update URL": "/admin/mobile?repair=update-url",
  "Queue backlog": "/admin/push",
  "RTMPS ingest": "/admin/stream",
  "RTMP ingest URL": "/admin/stream",
  "Stream key validation URL": "/admin/stream",
  "Playback URL": "/admin/stream",
  "Playback manifest": "/admin/stream",
  "Track artwork": "/admin/tracks?repair=missing-artwork",
  "Product images": "/admin/products?repair=missing-images",
  "Product variants": "/admin/products?repair=missing-variants",
  "Sticker packs": "/admin/chat-assets?repair=empty-packs",
  "Offline stream images": "/admin/stream?repair=missing-offline-image",
  "Site legal pages": "/admin/settings",
  "Site branding": "/admin/settings",
  "Site live social links": "/admin/settings",
  "Public app URL": "/admin/integrations",
  "Internal task token": "/admin/integrations"
};

export function productionReadinessRepairHref(label: string) {
  return productionReadinessRepairLinks[label];
}

export function paypalIntegrationHealthChecks(paypal: PayPalIntegrationData): HealthCheck[] {
  return paypal.checks.map((check) => ({
    detail: check.detail,
    label: check.label,
    status: check.status === "ready" ? "healthy" : "warning",
    value: check.value
  }));
}

export function productionReadinessStatus(items: Array<{ status: HealthStatus }>): HealthStatus {
  if (items.some((item) => item.status === "critical")) {
    return "critical";
  }

  if (items.some((item) => item.status === "warning")) {
    return "warning";
  }

  return "healthy";
}

export function productionReadinessIssues(groups: ProductionReadinessGroup[]): ProductionReadinessIssue[] {
  const severityRank: Record<HealthStatus, number> = {
    critical: 0,
    warning: 1,
    healthy: 2
  };

  const sortedIssues = groups
    .flatMap((group) =>
      group.items
        .filter((item) => item.status !== "healthy")
        .map((item) => ({
          ...item,
          groupId: group.id,
          groupTitle: group.title
        }))
    )
    .sort(
      (left, right) =>
        severityRank[left.status] - severityRank[right.status] ||
        left.groupTitle.localeCompare(right.groupTitle) ||
        left.label.localeCompare(right.label)
    );
  const seenLabels = new Set<string>();

  return sortedIssues.filter((issue) => {
    if (seenLabels.has(issue.label)) {
      return false;
    }

    seenLabels.add(issue.label);
    return true;
  });
}

function productionReadinessGroup({
  description,
  id,
  items,
  title
}: {
  description: string;
  id: string;
  items: HealthCheck[];
  title: string;
}): ProductionReadinessGroup {
  return {
    description,
    id,
    items,
    status: productionReadinessStatus(items),
    title
  };
}

function checkFromSource(checks: HealthCheck[], label: string): HealthCheck {
  const check = checks.find((sourceCheck) => sourceCheck.label === label);
  const href = productionReadinessRepairHref(label);

  if (check) {
    return {
      ...check,
      href: check.href ?? href
    };
  }

  return {
    detail: `${label} check was not available.`,
    href,
    label,
    status: "warning",
    value: "Missing"
  };
}

function smtpHealthCheck(): HealthCheck {
  const configured = mailIsConfigured();

  return {
    detail: configured
      ? "Brevo/SMTP credentials are present for account verification, password reset, and system email."
      : "Configure BREVO_SMTP_USER, BREVO_SMTP_KEY, and MAIL_FROM before production email can send.",
    label: "Brevo SMTP",
    status: configured ? "healthy" : "warning",
    value: configured ? "Configured" : "Missing"
  };
}

function enabled(key: string) {
  return process.env[key]?.trim().toLowerCase() === "true";
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function envNumber(key: string, fallback: number) {
  const value = Number(envValue(key));

  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function storedHttpsUrlIsInvalid(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    return new URL(value).protocol !== "https:";
  } catch {
    return true;
  }
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

function countQualityCheck({
  count,
  critical,
  detail,
  href,
  label,
  healthyDetail,
  singular,
  plural
}: {
  count: number;
  critical?: boolean;
  detail: string;
  href: string;
  label: string;
  healthyDetail: string;
  singular: string;
  plural: string;
}): HealthCheck {
  return {
    detail: count > 0 ? detail : healthyDetail,
    href,
    label,
    status: count > 0 ? (critical ? "critical" : "warning") : "healthy",
    value: count > 0 ? `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}` : "Clean"
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
  const staleWebhookCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const recentWebhookCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    databaseResult,
    streamResult,
    workerHeartbeat,
    activeSessions,
    chatRooms,
    recentMessages,
    auditLogs,
    queuedPushDeliveries,
    failedPayPalWebhooks,
    stalePayPalWebhooks,
    approvedPaidTracksMissingDelivery,
    paidPurchasesMissingDelivery,
    approvedTracksMissingArtwork,
    activeProductsMissingImages,
    activeProductsWithoutVariants,
    activeStickerPacksWithoutStickers,
    streamChannelsMissingOfflineImage,
    mobileConfigSetting,
    paypalIntegration,
    mobileConfigData,
    siteSettingsData
  ] = await Promise.all([
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
    getLatestWorkerHeartbeat().catch(() => null),
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
    prisma.auditLog.count(),
    prisma.mobilePushDelivery.count({
      where: {
        status: "queued"
      }
    }),
    prisma.payPalWebhookEvent.count({
      where: {
        processingStatus: "failed",
        receivedAt: {
          gte: recentWebhookCutoff
        }
      }
    }),
    prisma.payPalWebhookEvent.count({
      where: {
        processingStatus: "received",
        receivedAt: {
          lt: staleWebhookCutoff
        }
      }
    }),
    prisma.digitalTrack.count({
      where: {
        pricePence: {
          gt: 0
        },
        status: "approved",
        OR: [{ downloadUrl: null }, { downloadUrl: "" }]
      }
    }),
    prisma.digitalTrackPurchase.count({
      where: {
        status: "paid",
        OR: [{ downloadUrl: null }, { downloadUrl: "" }],
        track: {
          OR: [{ downloadUrl: null }, { downloadUrl: "" }]
        }
      }
    }),
    prisma.digitalTrack.count({
      where: {
        status: "approved",
        OR: [{ artworkUrl: null }, { artworkUrl: "" }]
      }
    }),
    prisma.product.count({
      where: {
        status: "active",
        OR: [{ imageUrl: null }, { imageUrl: "" }]
      }
    }),
    prisma.product.count({
      where: {
        status: "active",
        variants: {
          none: {}
        }
      }
    }),
    prisma.chatStickerPack.count({
      where: {
        status: "active",
        stickers: {
          none: {}
        }
      }
    }),
    prisma.streamChannel.count({
      where: {
        OR: [{ offlineImageUrl: null }, { offlineImageUrl: "" }]
      }
    }),
    prisma.appSetting.findUnique({
      where: {
        key: "mobile.config"
      },
      select: {
        value: true
      }
    }),
    getPayPalIntegrationData(),
    getAdminMobileConfigData(),
    getAdminSiteSettingsData()
  ]);
  const memoryTotal = totalmem();
  const memoryFree = freemem();
  const memoryUsedPercent = Math.round(((memoryTotal - memoryFree) / memoryTotal) * 100);
  const transcoderEnabled = enabled("TRANSCODER_ENABLED");
  const rtmpEncryption = envValue("MEDIA_GATEWAY_RTMP_ENCRYPTION") || "no";
  const rtmpsEnabled = rtmpEncryption === "optional" || rtmpEncryption === "strict";
  const workerHeartbeatStatus = getWorkerHeartbeatStatus(workerHeartbeat, {
    staleAfterSeconds: envNumber("WORKER_HEARTBEAT_STALE_SECONDS", 120)
  });
  const pushBacklogWarningThreshold = envNumber("WORKER_QUEUE_BACKLOG_WARNING", 250);
  const paypalWebhookStatus =
    failedPayPalWebhooks > 0 ? "critical" : stalePayPalWebhooks > 0 ? "warning" : ("healthy" as const);
  const savedMobileConfig = mobileConfigSetting?.value;
  const savedMobileVersion = isObject(savedMobileConfig) && isObject(savedMobileConfig.version) ? savedMobileConfig.version : {};
  const mobileUpdateUrlInvalid = storedHttpsUrlIsInvalid(savedMobileVersion.updateUrl);
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
  const mobileChecks = mobileConfigData.checks.map((check): HealthCheck => ({
    detail: check.detail,
    label: `Mobile ${check.label.toLowerCase()}`,
    status: check.status === "ready" ? "healthy" : "warning",
    value: check.value
  }));
  const siteSettingsChecks = siteSettingsData.checks.map((check): HealthCheck => ({
    detail: check.detail,
    label: `Site ${check.label.toLowerCase()}`,
    status: check.status === "ready" ? "healthy" : "warning",
    value: check.value
  }));
  const checks: HealthCheck[] = [
    {
      label: "App runtime",
      status: "healthy",
      value: process.env.NODE_ENV ?? "development",
      detail: `Node ${process.version}, uptime ${formatUptime(uptime())}`
    },
    databaseResult,
    {
      label: "Worker heartbeat",
      status: workerHeartbeatStatus.status,
      value: workerHeartbeatStatus.value,
      detail: workerHeartbeatStatus.detail
    },
    {
      label: "Stream provider",
      status: streamResult.health.status === "healthy" ? "healthy" : "warning",
      value: streamResult.status,
      detail: streamHealthDetail
    },
    envCheck("Public app URL", "NEXT_PUBLIC_APP_URL"),
    envCheck("Internal task token", "INTERNAL_TASK_TOKEN"),
    smtpHealthCheck(),
    envCheck("Tenor GIF API", "TENOR_API_KEY"),
    envCheck("Push token encryption", "PUSH_TOKEN_ENCRYPTION_KEY"),
    ...paypalIntegrationHealthChecks(paypalIntegration),
    ...mobileChecks,
    envCheck("RTMP ingest URL", "RTMP_INGEST_URL"),
    {
      detail: rtmpsEnabled
        ? "MediaMTX is configured to accept encrypted RTMPS ingest."
        : "Set MEDIA_GATEWAY_RTMP_ENCRYPTION to optional or strict to enable RTMPS ingest.",
      label: "RTMPS ingest",
      status: rtmpsEnabled ? "healthy" : "warning",
      value: rtmpEncryption
    },
    rtmpsEnabled ? envCheck("RTMPS port", "MEDIA_GATEWAY_RTMPS_BIND_PORT") : optionalEnvCheck("RTMPS port", "MEDIA_GATEWAY_RTMPS_BIND_PORT"),
    rtmpsEnabled
      ? envCheck("RTMPS certificate directory", "MEDIA_GATEWAY_RTMPS_CERT_DIR")
      : optionalEnvCheck("RTMPS certificate directory", "MEDIA_GATEWAY_RTMPS_CERT_DIR"),
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
    },
    {
      detail:
        queuedPushDeliveries > pushBacklogWarningThreshold
          ? `${queuedPushDeliveries.toLocaleString("en-GB")} push deliveries are queued, above the ${pushBacklogWarningThreshold.toLocaleString("en-GB")} warning threshold.`
          : `${queuedPushDeliveries.toLocaleString("en-GB")} mobile push deliveries are queued.`,
      label: "Queue backlog",
      status: queuedPushDeliveries > pushBacklogWarningThreshold ? "warning" : "healthy",
      value: queuedPushDeliveries.toLocaleString("en-GB")
    },
    {
      detail:
        failedPayPalWebhooks > 0
          ? `${failedPayPalWebhooks.toLocaleString("en-GB")} PayPal webhook events failed processing in the last 24 hours.`
          : stalePayPalWebhooks > 0
            ? `${stalePayPalWebhooks.toLocaleString("en-GB")} PayPal webhook events are still marked received after 15 minutes.`
            : "No failed PayPal webhook events in the last 24 hours.",
      label: "PayPal webhooks",
      status: paypalWebhookStatus,
      value:
        failedPayPalWebhooks > 0
          ? `${failedPayPalWebhooks.toLocaleString("en-GB")} failed`
          : stalePayPalWebhooks > 0
            ? `${stalePayPalWebhooks.toLocaleString("en-GB")} pending`
            : "Healthy"
    }
  ];
  const dataQuality: HealthCheck[] = [
    countQualityCheck({
      count: approvedPaidTracksMissingDelivery,
      critical: true,
      detail: "Approved paid music tracks need a download MP3 or Google Drive delivery link before users can buy them.",
      healthyDetail: "All approved paid music tracks have delivery links.",
      href: "/admin/tracks?repair=missing-delivery",
      label: "Paid track delivery",
      singular: "track",
      plural: "tracks"
    }),
    countQualityCheck({
      count: paidPurchasesMissingDelivery,
      critical: true,
      detail: "Paid music purchases without any stored or current track download URL will fail when customers open downloads.",
      healthyDetail: "All paid music purchases resolve to a delivery URL.",
      href: "/admin/tracks?repair=missing-delivery",
      label: "Paid purchase delivery",
      singular: "purchase",
      plural: "purchases"
    }),
    countQualityCheck({
      count: approvedTracksMissingArtwork,
      detail: "Approved music tracks without artwork still sell, but the public catalogue has broken or weak visual presentation.",
      healthyDetail: "All approved music tracks have artwork.",
      href: "/admin/tracks?repair=missing-artwork",
      label: "Track artwork",
      singular: "track",
      plural: "tracks"
    }),
    countQualityCheck({
      count: activeProductsMissingImages,
      detail: "Active shop products without product images weaken the storefront and can look broken in mobile clients.",
      healthyDetail: "All active shop products have images.",
      href: "/admin/products?repair=missing-images",
      label: "Product images",
      singular: "product",
      plural: "products"
    }),
    countQualityCheck({
      count: activeProductsWithoutVariants,
      critical: true,
      detail: "Active shop products without variants cannot be added to checkout correctly.",
      healthyDetail: "All active shop products have at least one variant.",
      href: "/admin/products?repair=missing-variants",
      label: "Product variants",
      singular: "product",
      plural: "products"
    }),
    countQualityCheck({
      count: activeStickerPacksWithoutStickers,
      detail: "Active chat sticker packs without stickers appear empty to users.",
      healthyDetail: "All active chat sticker packs contain stickers.",
      href: "/admin/chat-assets?repair=empty-packs",
      label: "Sticker packs",
      singular: "pack",
      plural: "packs"
    }),
    {
      detail:
        streamChannelsMissingOfflineImage > 0
          ? `${streamChannelsMissingOfflineImage.toLocaleString("en-GB")} stream ${
              streamChannelsMissingOfflineImage === 1 ? "channel uses" : "channels use"
            } the built-in offline image at ${defaultStreamOfflineImageUrl}. Upload custom offline images when each channel needs its own artwork.`
          : "All stream channels have custom offline images.",
      href: streamChannelsMissingOfflineImage > 0 ? "/admin/stream?repair=missing-offline-image" : undefined,
      label: "Offline stream images",
      status: "healthy",
      value: streamChannelsMissingOfflineImage > 0 ? "Default fallback" : "Clean"
    },
    {
      detail: mobileUpdateUrlInvalid
        ? "Saved mobile update URL is invalid or not HTTPS. The public mobile config now ignores it until repaired."
        : "Saved mobile update URL is empty or valid HTTPS.",
      href: "/admin/mobile?repair=update-url",
      label: "Mobile update URL",
      status: mobileUpdateUrlInvalid ? "warning" : "healthy",
      value: mobileUpdateUrlInvalid ? "Repair needed" : "Clean"
    }
  ];
  const checkSources = [...checks, ...dataQuality, ...siteSettingsChecks];
  const productionReadiness: ProductionReadinessGroup[] = [
    productionReadinessGroup({
      description: "PayPal credentials, checkout surfaces, webhook processing, and customer delivery integrity.",
      id: "payments",
      title: "Payments",
      items: [
        checkFromSource(checkSources, "Payment rail"),
        checkFromSource(checkSources, "PayPal client ID"),
        checkFromSource(checkSources, "PayPal client secret"),
        checkFromSource(checkSources, "PayPal webhook ID"),
        checkFromSource(checkSources, "PayPal webhooks"),
        checkFromSource(checkSources, "Paid track delivery"),
        checkFromSource(checkSources, "Paid purchase delivery")
      ]
    }),
    productionReadinessGroup({
      description: "Account verification, password reset, sender identity, and public support contact readiness.",
      id: "email-support",
      title: "Email and support",
      items: [
        checkFromSource(checkSources, "Brevo SMTP"),
        checkFromSource(checkSources, "Site support email"),
        checkFromSource(checkSources, "Site config source")
      ]
    }),
    productionReadinessGroup({
      description: "Mobile FCM configuration, encrypted device tokens, worker dispatch, and queue backlog.",
      id: "push-mobile",
      title: "Push and mobile",
      items: [
        checkFromSource(checkSources, "Push token encryption"),
        checkFromSource(checkSources, "Mobile android push"),
        checkFromSource(checkSources, "Mobile config source"),
        checkFromSource(checkSources, "Mobile update URL"),
        checkFromSource(checkSources, "Queue backlog")
      ]
    }),
    productionReadinessGroup({
      description: "RTMPS ingest, stream-key validation, playback manifest, and adaptive/direct HLS readiness.",
      id: "streaming",
      title: "Streaming",
      items: [
        checkFromSource(checkSources, "RTMPS ingest"),
        checkFromSource(checkSources, "RTMP ingest URL"),
        checkFromSource(checkSources, "Stream key validation URL"),
        checkFromSource(checkSources, "Playback URL"),
        checkFromSource(checkSources, "Playback manifest")
      ]
    }),
    productionReadinessGroup({
      description: "Public catalogue images, track artwork, stickers, product variants, and offline stream presentation.",
      id: "uploads-content",
      title: "Uploads and content",
      items: [
        checkFromSource(checkSources, "Track artwork"),
        checkFromSource(checkSources, "Product images"),
        checkFromSource(checkSources, "Product variants"),
        checkFromSource(checkSources, "Sticker packs"),
        checkFromSource(checkSources, "Offline stream images")
      ]
    }),
    productionReadinessGroup({
      description: "Privacy policy, cookie/terms pages, branding, live links, and consent-facing public configuration.",
      id: "legal-privacy",
      title: "Legal and privacy",
      items: [
        checkFromSource(checkSources, "Site legal pages"),
        checkFromSource(checkSources, "Site branding"),
        checkFromSource(checkSources, "Site live social links"),
        checkFromSource(checkSources, "Site support email")
      ]
    }),
    productionReadinessGroup({
      description: "Runtime, database, worker heartbeat, internal task security, and public URL configuration.",
      id: "operations",
      title: "Operations",
      items: [
        checkFromSource(checkSources, "App runtime"),
        checkFromSource(checkSources, "Database"),
        checkFromSource(checkSources, "Worker heartbeat"),
        checkFromSource(checkSources, "Public app URL"),
        checkFromSource(checkSources, "Internal task token")
      ]
    })
  ];
  const allChecks = [...checks, ...dataQuality, ...siteSettingsChecks];
  const criticalChecks = allChecks.filter((check) => check.status === "critical").length;
  const warningChecks = allChecks.filter((check) => check.status === "warning").length;
  const productionIssues = productionReadinessIssues(productionReadiness);

  return {
    checkedAt: new Date().toISOString(),
    overallStatus: criticalChecks ? "critical" : warningChecks ? "warning" : "healthy",
    checks,
    dataQuality,
    productionReadiness,
    productionIssues,
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
        label: "Push queue",
        value: queuedPushDeliveries.toLocaleString("en-GB"),
        detail: `Warning threshold: ${pushBacklogWarningThreshold.toLocaleString("en-GB")} queued deliveries`
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
