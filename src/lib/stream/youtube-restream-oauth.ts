import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { appUrl, configuredAppOrigin } from "@/lib/http/app-url";
import { decryptSecret, encryptSecret, secretEncryptionConfigured } from "@/lib/security/secret-crypto";
import { restreamTargetSlotValue, type RestreamTargetSlot } from "@/lib/stream/restream-settings";

const youtubeOAuthScope = "https://www.googleapis.com/auth/youtube.force-ssl";
const youtubeCredentialsSettingKey = "stream.youtube_oauth_credentials";
const youtubeConnectionSettingKeys: Record<RestreamTargetSlot, string> = {
  primary: "stream.youtube_oauth.primary",
  secondary: "stream.youtube_oauth.secondary"
};

export const youtubeOAuthCookieName = "bouncecore_youtube_oauth";

export type YouTubeOAuthState = {
  actorId: string;
  issuedAt: string;
  slot: RestreamTargetSlot;
  state: string;
};

export type YouTubeRestreamRuntime = {
  broadcastId: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  sessionId: string | null;
  status: "idle" | "creating" | "bound" | "live" | "complete" | "error";
  streamId: string | null;
  updatedAt: string;
};

export type YouTubeRestreamConnectionRecord = {
  channelId: string;
  channelTitle: string;
  connectedAt: string;
  refreshTokenCiphertext: string;
  runtime: YouTubeRestreamRuntime;
};

export type AdminYouTubeOAuthCredentials = {
  clientId: string;
  clientSecretConfigured: boolean;
  configured: boolean;
  redirectUri: string | null;
  source: "admin" | "environment" | "google-drive" | "missing";
};

export type AdminYouTubeRestreamConnection = {
  channelId: string | null;
  channelTitle: string | null;
  connected: boolean;
  connectedAt: string | null;
  lastBroadcastId: string | null;
  lastError: string | null;
  runtimeStatus: YouTubeRestreamRuntime["status"];
};

type YouTubeOAuthCredentialsInput = {
  clearClientSecret?: boolean;
  clientId: string;
  clientSecret?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function defaultRuntime(): YouTubeRestreamRuntime {
  return {
    broadcastId: null,
    lastAttemptAt: null,
    lastError: null,
    sessionId: null,
    status: "idle",
    streamId: null,
    updatedAt: new Date(0).toISOString()
  };
}

function normalizeRuntime(value: unknown): YouTubeRestreamRuntime {
  const runtime = objectValue(value);
  const status = textValue(runtime.status);

  return {
    broadcastId: textValue(runtime.broadcastId) || null,
    lastAttemptAt: textValue(runtime.lastAttemptAt) || null,
    lastError: textValue(runtime.lastError, 1000) || null,
    sessionId: textValue(runtime.sessionId) || null,
    status:
      status === "creating" || status === "bound" || status === "live" || status === "complete" || status === "error"
        ? status
        : "idle",
    streamId: textValue(runtime.streamId) || null,
    updatedAt: textValue(runtime.updatedAt) || new Date(0).toISOString()
  };
}

function normalizeConnection(value: unknown): YouTubeRestreamConnectionRecord | null {
  const connection = objectValue(value);
  const channelId = textValue(connection.channelId);
  const channelTitle = textValue(connection.channelTitle, 200);
  const connectedAt = textValue(connection.connectedAt);
  const refreshTokenCiphertext = textValue(connection.refreshTokenCiphertext, 12000);

  if (!channelId || !channelTitle || !connectedAt || !refreshTokenCiphertext) {
    return null;
  }

  return {
    channelId,
    channelTitle,
    connectedAt,
    refreshTokenCiphertext,
    runtime: normalizeRuntime(connection.runtime)
  };
}

async function storedCredentials() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: youtubeCredentialsSettingKey
    }
  });
  const value = objectValue(setting?.value);

  return {
    clientId: textValue(value.clientId, 500),
    clientSecretCiphertext: textValue(value.clientSecretCiphertext, 12000)
  };
}

async function youtubeOAuthCredentials() {
  const stored = await storedCredentials();

  if (stored.clientId && stored.clientSecretCiphertext) {
    return {
      clientId: stored.clientId,
      clientSecret: decryptSecret(stored.clientSecretCiphertext),
      source: "admin" as const
    };
  }

  const youtubeClientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim() ?? "";
  const youtubeClientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim() ?? "";

  if (youtubeClientId && youtubeClientSecret) {
    return {
      clientId: youtubeClientId,
      clientSecret: youtubeClientSecret,
      source: "environment" as const
    };
  }

  const driveClientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim() ?? "";
  const driveClientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim() ?? "";

  if (driveClientId && driveClientSecret) {
    return {
      clientId: driveClientId,
      clientSecret: driveClientSecret,
      source: "google-drive" as const
    };
  }

  return {
    clientId: stored.clientId,
    clientSecret: "",
    source: "missing" as const
  };
}

export async function getAdminYouTubeOAuthCredentials(): Promise<AdminYouTubeOAuthCredentials> {
  const credentials = await youtubeOAuthCredentials();
  const origin = configuredAppOrigin();

  return {
    clientId: credentials.clientId,
    clientSecretConfigured: Boolean(credentials.clientSecret),
    configured: Boolean(credentials.clientId && credentials.clientSecret && secretEncryptionConfigured()),
    redirectUri: origin ? new URL("/admin/stream/youtube/callback", origin).toString() : null,
    source: credentials.source
  };
}

export async function updateYouTubeOAuthCredentials(input: YouTubeOAuthCredentialsInput, actorId: string) {
  const existing = await storedCredentials();
  const clientId = textValue(input.clientId, 500);
  const providedSecret = textValue(input.clientSecret, 4000);
  let clientSecretCiphertext = input.clearClientSecret ? "" : existing.clientSecretCiphertext;

  if (providedSecret) {
    clientSecretCiphertext = encryptSecret(providedSecret) ?? "";

    if (!clientSecretCiphertext) {
      throw new Error("Push token encryption must be configured before a YouTube OAuth secret can be saved.");
    }
  }

  await prisma.appSetting.upsert({
    where: {
      key: youtubeCredentialsSettingKey
    },
    update: {
      description: "Encrypted YouTube Live OAuth client credentials.",
      isSecret: true,
      value: {
        clientId,
        clientSecretCiphertext
      }
    },
    create: {
      description: "Encrypted YouTube Live OAuth client credentials.",
      isSecret: true,
      key: youtubeCredentialsSettingKey,
      value: {
        clientId,
        clientSecretCiphertext
      }
    }
  });

  await writeAuditLog({
    action: "stream.youtube_oauth.credentials.update",
    actorId,
    metadata: {
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(clientSecretCiphertext)
    },
    severity: "warning",
    target: "stream:youtube-oauth"
  });
}

export function createYouTubeOAuthState(actorId: string, slot: RestreamTargetSlot): YouTubeOAuthState {
  return {
    actorId,
    issuedAt: new Date().toISOString(),
    slot,
    state: randomBytes(24).toString("base64url")
  };
}

export function encodeYouTubeOAuthStateCookie(state: YouTubeOAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeYouTubeOAuthStateCookie(value: string | undefined): YouTubeOAuthState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<YouTubeOAuthState>;
    const issuedAt = new Date(parsed.issuedAt ?? "");

    if (!parsed.actorId || !parsed.state || !parsed.slot || !Number.isFinite(issuedAt.getTime())) {
      return null;
    }

    if (Date.now() - issuedAt.getTime() > 15 * 60 * 1000) {
      return null;
    }

    return {
      actorId: parsed.actorId,
      issuedAt: issuedAt.toISOString(),
      slot: restreamTargetSlotValue(parsed.slot),
      state: parsed.state
    };
  } catch {
    return null;
  }
}

export function youtubeOAuthRedirectUri(request: Request) {
  return appUrl(request, "/admin/stream/youtube/callback").toString();
}

export async function youtubeAuthorizationUrl(request: Request, state: YouTubeOAuthState) {
  const credentials = await youtubeOAuthCredentials();

  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error("Configure the YouTube OAuth client ID and secret before connecting a channel.");
  }

  if (!secretEncryptionConfigured()) {
    throw new Error("Push token encryption must be configured before connecting a YouTube channel.");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("access_type", "offline");
  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", youtubeOAuthRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", youtubeOAuthScope);
  url.searchParams.set("state", state.state);

  return url;
}

export async function exchangeYouTubeAuthorizationCode(request: Request, code: string): Promise<GoogleTokenResponse> {
  const credentials = await youtubeOAuthCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: youtubeOAuthRedirectUri(request)
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok || body.error || !body.access_token || !body.refresh_token) {
    throw new Error(body.error_description || body.error || "YouTube did not return an offline access token.");
  }

  return body;
}

async function youtubeChannelIdentity(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("mine", "true");
  url.searchParams.set("part", "id,snippet");
  url.searchParams.set("maxResults", "1");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  };
  const channel = body.items?.[0];

  if (!response.ok || !channel?.id || !channel.snippet?.title) {
    throw new Error(body.error?.message || "The authorized YouTube channel could not be read.");
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet.title
  };
}

export async function completeYouTubeOAuth({
  actorId,
  slot,
  token
}: {
  actorId: string;
  slot: RestreamTargetSlot;
  token: GoogleTokenResponse;
}) {
  const refreshTokenCiphertext = encryptSecret(token.refresh_token ?? "");

  if (!token.access_token || !refreshTokenCiphertext) {
    throw new Error("The YouTube channel token could not be stored securely.");
  }

  const channel = await youtubeChannelIdentity(token.access_token);
  const connectedAt = new Date().toISOString();
  const value: YouTubeRestreamConnectionRecord = {
    ...channel,
    connectedAt,
    refreshTokenCiphertext,
    runtime: defaultRuntime()
  };

  await prisma.appSetting.upsert({
    where: {
      key: youtubeConnectionSettingKeys[slot]
    },
    update: {
      description: `Encrypted YouTube Live OAuth connection for restream ${slot}.`,
      isSecret: true,
      value: value as unknown as Prisma.InputJsonValue
    },
    create: {
      description: `Encrypted YouTube Live OAuth connection for restream ${slot}.`,
      isSecret: true,
      key: youtubeConnectionSettingKeys[slot],
      value: value as unknown as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    action: "stream.youtube_oauth.connect",
    actorId,
    metadata: {
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      slot
    },
    severity: "warning",
    target: `stream:restream:${slot}`
  });

  return value;
}

export async function getYouTubeRestreamConnectionRecord(slot: RestreamTargetSlot) {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: youtubeConnectionSettingKeys[slot]
    }
  });

  return normalizeConnection(setting?.value);
}

export async function getAdminYouTubeRestreamConnection(slot: RestreamTargetSlot): Promise<AdminYouTubeRestreamConnection> {
  const connection = await getYouTubeRestreamConnectionRecord(slot);

  return {
    channelId: connection?.channelId ?? null,
    channelTitle: connection?.channelTitle ?? null,
    connected: Boolean(connection),
    connectedAt: connection?.connectedAt ?? null,
    lastBroadcastId: connection?.runtime.broadcastId ?? null,
    lastError: connection?.runtime.lastError ?? null,
    runtimeStatus: connection?.runtime.status ?? "idle"
  };
}

export async function getYouTubeAccessToken(slot: RestreamTargetSlot) {
  const [connection, credentials] = await Promise.all([
    getYouTubeRestreamConnectionRecord(slot),
    youtubeOAuthCredentials()
  ]);

  if (!connection) {
    throw new Error("Connect the YouTube channel before enabling automatic public broadcasts.");
  }

  const refreshToken = decryptSecret(connection.refreshTokenCiphertext);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const body = (await response.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error_description || body.error || "YouTube channel authorization could not be refreshed.");
  }

  return body.access_token;
}

export async function updateYouTubeRestreamRuntime(slot: RestreamTargetSlot, runtime: YouTubeRestreamRuntime) {
  const connection = await getYouTubeRestreamConnectionRecord(slot);

  if (!connection) {
    throw new Error("The YouTube channel connection no longer exists.");
  }

  await prisma.appSetting.update({
    data: {
      value: {
        ...connection,
        runtime
      } as unknown as Prisma.InputJsonValue
    },
    where: {
      key: youtubeConnectionSettingKeys[slot]
    }
  });
}

export async function disconnectYouTubeRestream(slot: RestreamTargetSlot, actorId: string) {
  await prisma.appSetting.deleteMany({
    where: {
      key: youtubeConnectionSettingKeys[slot]
    }
  });

  await writeAuditLog({
    action: "stream.youtube_oauth.disconnect",
    actorId,
    metadata: {
      slot
    },
    severity: "warning",
    target: `stream:restream:${slot}`
  });
}
