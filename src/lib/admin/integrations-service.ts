import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getAdminStreamControlData } from "@/lib/stream/stream-channel-service";
import { getStreamProviderMode } from "@/lib/stream/stream-provider";

export type IntegrationStatus = "ready" | "partial" | "missing";

export type IntegrationCheck = {
  label: string;
  status: IntegrationStatus;
  value: string;
  detail: string;
};

export type IntegrationSurface = {
  label: string;
  href: string;
  detail: string;
};

export type IntegrationGroup = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  status: IntegrationStatus;
  statusLabel: string;
  primaryHref: string;
  primaryLabel: string;
  checks: IntegrationCheck[];
  surfaces: IntegrationSurface[];
};

export type AdminIntegrationsData = {
  groups: IntegrationGroup[];
  readyCount: number;
  attentionCount: number;
  totalCount: number;
};

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function configured(key: string) {
  return Boolean(envValue(key));
}

function publicValue(key: string) {
  return envValue(key) || "Not configured";
}

function check(label: string, ready: boolean, value: string, detail: string): IntegrationCheck {
  return {
    detail,
    label,
    status: ready ? "ready" : "missing",
    value
  };
}

function optionalCheck(label: string, configuredValue: boolean, detail: string): IntegrationCheck {
  return {
    detail,
    label,
    status: "ready",
    value: configuredValue ? "Configured" : "Optional"
  };
}

function groupStatus(checks: IntegrationCheck[]): IntegrationStatus {
  const ready = checks.filter((item) => item.status === "ready").length;

  if (ready === checks.length) {
    return "ready";
  }

  return ready > 0 ? "partial" : "missing";
}

function statusLabel(status: IntegrationStatus) {
  if (status === "ready") {
    return "Ready";
  }

  return status === "partial" ? "Needs attention" : "Missing config";
}

function appOrigin() {
  return envValue("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

function absolutePath(path: string) {
  const origin = appOrigin();

  return origin ? `${origin}${path}` : path;
}

export async function getAdminIntegrationsData(): Promise<AdminIntegrationsData> {
  const [paypal, stream] = await Promise.all([getPayPalIntegrationData(), getAdminStreamControlData()]);
  const streamProviderMode = getStreamProviderMode();
  const streamProviderReady = streamProviderMode !== "mock" && configured("STREAM_CORE_INTERNAL_URL");
  const paypalChecks: IntegrationCheck[] = paypal.checks.map((item) => ({
    detail: item.detail,
    label: item.label,
    status: item.status === "ready" ? "ready" : "missing",
    value: item.value
  }));
  const tenorChecks: IntegrationCheck[] = [
    check("Tenor API key", configured("TENOR_API_KEY"), configured("TENOR_API_KEY") ? "Configured" : "Missing", "TENOR_API_KEY is required for GIF search in chat."),
    check("Client key", true, "bouncecore-platform", "Tenor requests use a fixed Bouncecore client key."),
    check("Content filter", true, "Medium", "GIF search is restricted to the GB locale with medium content filtering.")
  ];
  const streamChecks: IntegrationCheck[] = [
    check(
      "Stream provider",
      streamProviderReady,
      streamProviderMode,
      streamProviderMode === "mock"
        ? "Mock mode is available for local fallback. Use stream-core/http mode for real provider telemetry."
        : "Provider selector behind the stream boundary."
    ),
    check(
      "Stream-core URL",
      configured("STREAM_CORE_INTERNAL_URL"),
      publicValue("STREAM_CORE_INTERNAL_URL"),
      "Internal HTTP source for stream status, health, playback, and viewer telemetry."
    ),
    check("Public playback URL", Boolean(stream.provider.playbackUrl), stream.provider.playbackUrl ?? "Not configured", "Used by the live player and public status surfaces."),
    check("RTMP ingest URL", configured("RTMP_INGEST_URL"), publicValue("RTMP_INGEST_URL"), "Shown to streamers in OBS setup."),
    check(
      "Internal stream token",
      configured("STREAM_CORE_INTERNAL_TOKEN"),
      configured("STREAM_CORE_INTERNAL_TOKEN") ? "Configured" : "Missing",
      "Internal stream-core token stays in server environment."
    )
  ];
  const platformChecks: IntegrationCheck[] = [
    check("Public app URL", configured("NEXT_PUBLIC_APP_URL"), publicValue("NEXT_PUBLIC_APP_URL"), "Used for checkout returns, invite links, and OBS browser sources."),
    check("Mobile config API", true, absolutePath("/api/mobile/v1/config"), "Public mobile app configuration endpoint."),
    check(
      "Internal task token",
      configured("INTERNAL_TASK_TOKEN"),
      configured("INTERNAL_TASK_TOKEN") ? "Configured" : "Missing",
      "Required for scheduled mobile push queue and receipt processing."
    ),
    check(
      "Push token encryption",
      configured("PUSH_TOKEN_ENCRYPTION_KEY"),
      configured("PUSH_TOKEN_ENCRYPTION_KEY") ? "Configured" : "Missing",
      "Required to store deliverable mobile push tokens without exposing raw token values."
    ),
    optionalCheck(
      "Expo access token",
      configured("EXPO_PUSH_ACCESS_TOKEN"),
      "Only required when Expo push security is enabled in the Expo dashboard."
    ),
    check("Star alert overlay", true, absolutePath("/overlay/stars"), "Transparent OBS browser source for live star alerts."),
    check("Redis URL", configured("REDIS_URL"), configured("REDIS_URL") ? "Configured" : "Missing", "Supports realtime chat, queues, presence, and background workers.")
  ];

  const groups: IntegrationGroup[] = [
    {
      checks: paypalChecks,
      description: "Single payment rail for stars packages, merch checkout, music purchases, and producer payouts.",
      eyebrow: `PayPal ${paypal.settings.mode}`,
      id: "paypal",
      primaryHref: "/admin/payments",
      primaryLabel: "Open payments",
      status: groupStatus(paypalChecks),
      statusLabel: statusLabel(groupStatus(paypalChecks)),
      surfaces: paypal.useCases.map((item) => ({
        detail: `${item.rail} - ${item.enabled ? "enabled" : "disabled"}`,
        href: item.surface.split(" and ")[0],
        label: item.label
      })),
      title: "PayPal payments"
    },
    {
      checks: tenorChecks,
      description: "GIF search and selected media messages for live chat, backed by the Tenor API.",
      eyebrow: "Chat media",
      id: "tenor",
      primaryHref: "/chat",
      primaryLabel: "Open chat",
      status: groupStatus(tenorChecks),
      statusLabel: statusLabel(groupStatus(tenorChecks)),
      surfaces: [
        {
          detail: "Search and send GIFs from the public chat UI.",
          href: "/chat",
          label: "Public chat"
        },
        {
          detail: "Same room data appears inside the live page chat column.",
          href: "/live",
          label: "Live chat"
        }
      ],
      title: "Tenor GIF search"
    },
    {
      checks: streamChecks,
      description: "Stream provider boundary, public playback, ingest details, health, and OBS setup visibility.",
      eyebrow: `${stream.channels.length} channel${stream.channels.length === 1 ? "" : "s"}`,
      id: "stream",
      primaryHref: "/admin/stream",
      primaryLabel: "Open stream dashboard",
      status: groupStatus(streamChecks),
      statusLabel: statusLabel(groupStatus(streamChecks)),
      surfaces: [
        {
          detail: "Public playback page with live/offline player state.",
          href: "/live",
          label: "Live page"
        },
        {
          detail: "Streamer connection settings and OBS browser sources.",
          href: "/streamer/obs",
          label: "OBS setup"
        },
        {
          detail: `Provider health is currently ${stream.provider.health.status}.`,
          href: "/admin/stream",
          label: "Stream health"
        }
      ],
      title: "Stream provider"
    },
    {
      checks: platformChecks,
      description: "Public URLs, mobile config, alert overlays, and runtime infrastructure expected by external clients.",
      eyebrow: "Platform runtime",
      id: "platform",
      primaryHref: "/admin/mobile",
      primaryLabel: "Open app config",
      status: groupStatus(platformChecks),
      statusLabel: statusLabel(groupStatus(platformChecks)),
      surfaces: [
        {
          detail: "Mobile app feature flags and launch state.",
          href: "/admin/mobile",
          label: "Mobile app config"
        },
        {
          detail: "Transparent browser source for OBS star alerts.",
          href: "/overlay/stars",
          label: "Star overlay"
        },
        {
          detail: "Public API response used by the mobile shell.",
          href: "/api/mobile/v1/config",
          label: "Mobile config API"
        },
        {
          detail: "Token-protected endpoint for scheduled push queue and receipt processing.",
          href: "/internal/tasks/mobile-push",
          label: "Mobile push task"
        }
      ],
      title: "Platform endpoints"
    }
  ];

  return {
    attentionCount: groups.filter((group) => group.status !== "ready").length,
    groups,
    readyCount: groups.filter((group) => group.status === "ready").length,
    totalCount: groups.length
  };
}
