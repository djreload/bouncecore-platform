import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getAdminStreamControlData } from "@/lib/stream/stream-channel-service";
import { getHlsPlaybackHealth, type HlsPlaybackHealth } from "@/lib/stream/hls-playback-health";
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

function enabled(key: string) {
  return envValue(key).toLowerCase() === "true";
}

function check(label: string, ready: boolean, value: string, detail: string): IntegrationCheck {
  return {
    detail,
    label,
    status: ready ? "ready" : "missing",
    value
  };
}

function modeCheck(label: string, active: boolean, activeDetail: string, inactiveDetail: string): IntegrationCheck {
  return {
    detail: active ? activeDetail : inactiveDetail,
    label,
    status: "ready",
    value: active ? "Enabled" : "Disabled"
  };
}

function enabledEnvCheck(label: string, key: string, active: boolean, detail: string): IntegrationCheck {
  if (!active) {
    return {
      detail: `${key} is only required when TRANSCODER_ENABLED=true.`,
      label,
      status: "ready",
      value: "Optional"
    };
  }

  return check(label, configured(key), publicValue(key), detail);
}

function optionalCheck(label: string, configuredValue: boolean, detail: string): IntegrationCheck {
  return {
    detail,
    label,
    status: "ready",
    value: configuredValue ? "Configured" : "Optional"
  };
}

function manifestCheck(playbackHealth: HlsPlaybackHealth): IntegrationCheck {
  return {
    detail: playbackHealth.detail,
    label: "Playback manifest",
    status: playbackHealth.status === "healthy" ? "ready" : "partial",
    value: playbackHealth.value
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
  const normalizedStreamProviderMode = streamProviderMode.toLowerCase();
  const streamProviderReady =
    (normalizedStreamProviderMode === "stream-core" || normalizedStreamProviderMode === "http") &&
    configured("STREAM_CORE_INTERNAL_URL");
  const transcoderEnabled = enabled("TRANSCODER_ENABLED");
  const streamIsActive = stream.provider.health.ingestConnected || stream.provider.status !== "offline";
  const playbackUrl = transcoderEnabled ? envValue("TRANSCODER_HLS_PUBLIC_URL") || stream.provider.playbackUrl : stream.provider.playbackUrl;
  const playbackHealth = await getHlsPlaybackHealth({
    adaptive: transcoderEnabled,
    live: streamIsActive,
    playbackUrl: envValue("HLS_PLAYBACK_HEALTH_URL") || playbackUrl
  });
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
  const mailChecks: IntegrationCheck[] = [
    check("Brevo SMTP host", configured("BREVO_SMTP_HOST") || configured("SMTP_HOST"), envValue("BREVO_SMTP_HOST") || envValue("SMTP_HOST") || "smtp-relay.brevo.com", "SMTP relay host for transactional account emails."),
    check("Brevo SMTP port", configured("BREVO_SMTP_PORT") || configured("SMTP_PORT"), envValue("BREVO_SMTP_PORT") || envValue("SMTP_PORT") || "587", "Brevo recommends port 587 for SMTP submission."),
    check("SMTP username", configured("BREVO_SMTP_USER") || configured("SMTP_USER"), configured("BREVO_SMTP_USER") || configured("SMTP_USER") ? "Configured" : "Missing", "Brevo SMTP username from SMTP and API settings."),
    check("SMTP key", configured("BREVO_SMTP_KEY") || configured("BREVO_SMTP_PASSWORD") || configured("SMTP_PASSWORD"), configured("BREVO_SMTP_KEY") || configured("BREVO_SMTP_PASSWORD") || configured("SMTP_PASSWORD") ? "Configured" : "Missing", "Use a Brevo SMTP key for SMTP relay authentication."),
    check("From address", configured("MAIL_FROM") || configured("SMTP_FROM"), envValue("MAIL_FROM") || envValue("SMTP_FROM") || "Missing", "Verified sender address used for account verification and invites."),
    check("Verification page", true, absolutePath("/auth/verify-email"), "Signup verification and resend flow."),
    check("Password reset page", true, absolutePath("/auth/forgot-password"), "Password reset request and token flow.")
  ];
  const streamChecks: IntegrationCheck[] = [
    check(
      "Stream provider",
      streamProviderReady,
      streamProviderMode,
      normalizedStreamProviderMode === "mock"
        ? "Mock mode is local-only. Use stream-core/http mode for real provider telemetry."
        : normalizedStreamProviderMode === "unconfigured"
          ? "Set STREAM_PROVIDER=stream-core and STREAM_CORE_INTERNAL_URL before production streaming."
        : "Provider selector behind the stream boundary."
    ),
    check(
      "Stream-core URL",
      configured("STREAM_CORE_INTERNAL_URL"),
      publicValue("STREAM_CORE_INTERNAL_URL"),
      "Internal HTTP source for stream status, health, playback, and viewer telemetry."
    ),
    check("Public playback URL", Boolean(stream.provider.playbackUrl), stream.provider.playbackUrl ?? "Not configured", "Used by the live player and public status surfaces."),
    optionalCheck(
      "Playback health URL",
      configured("HLS_PLAYBACK_HEALTH_URL"),
      "Optional server-side HLS URL for admin manifest checks when the public URL is not reachable from the app container."
    ),
    manifestCheck(playbackHealth),
    check("RTMP ingest URL", configured("RTMP_INGEST_URL"), publicValue("RTMP_INGEST_URL"), "Shown to streamers in OBS setup."),
    optionalCheck(
      "Media gateway HLS template",
      configured("MEDIA_GATEWAY_PUBLIC_HLS_URL"),
      "Optional MediaMTX HLS URL template used by stream-core after authenticated RTMP publish."
    ),
    modeCheck(
      "Adaptive HLS transcoder",
      transcoderEnabled,
      "FFmpeg adaptive HLS is expected to publish a multi-variant master playlist.",
      "Direct MediaMTX HLS remains available; enable TRANSCODER_ENABLED when the FFmpeg adaptive profile is deployed."
    ),
    enabledEnvCheck(
      "Adaptive HLS master URL",
      "TRANSCODER_HLS_PUBLIC_URL",
      transcoderEnabled,
      "Public multi-variant master playlist used by browser automatic bitrate switching."
    ),
    enabledEnvCheck(
      "Transcoder RTMP input",
      "TRANSCODER_INPUT_URL",
      transcoderEnabled,
      "Internal RTMP source read by the FFmpeg adaptive HLS worker."
    ),
    enabledEnvCheck(
      "HLS origin host port",
      "TRANSCODER_HLS_BIND_PORT",
      transcoderEnabled,
      "Local host port for the static HLS origin serving adaptive playlists and segments."
    ),
    check(
      "Stream-key validation",
      configured("STREAM_CORE_KEY_VALIDATION_URL") && configured("INTERNAL_TASK_TOKEN"),
      configured("STREAM_CORE_KEY_VALIDATION_URL") ? publicValue("STREAM_CORE_KEY_VALIDATION_URL") : "Missing",
      "Internal endpoint used by stream-core or RTMP publish hooks to accept only active Bouncecore stream keys."
    ),
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
      checks: mailChecks,
      description: "Transactional account email for signup verification, password reset, and admin-created user invites.",
      eyebrow: "SMTP relay",
      id: "mail",
      primaryHref: "/auth/verify-email",
      primaryLabel: "Open verification",
      status: groupStatus(mailChecks),
      statusLabel: statusLabel(groupStatus(mailChecks)),
      surfaces: [
        {
          detail: "New accounts receive a verification link before login is allowed.",
          href: "/auth/register",
          label: "Registration"
        },
        {
          detail: "Admins can create user invites and email the invite link automatically.",
          href: "/admin/users",
          label: "User invites"
        },
        {
          detail: "Users can request another verification email.",
          href: "/auth/verify-email",
          label: "Verification resend"
        },
        {
          detail: "Users can request a one-hour password reset link.",
          href: "/auth/forgot-password",
          label: "Password reset"
        }
      ],
      title: "Brevo SMTP email"
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
