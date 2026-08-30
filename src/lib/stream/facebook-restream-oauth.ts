import { createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { appUrl, configuredAppOrigin } from "@/lib/http/app-url";
import { decryptSecret, encryptSecret, secretEncryptionConfigured } from "@/lib/security/secret-crypto";
import { restreamTargetSlotValue, type RestreamTargetSlot } from "@/lib/stream/restream-settings";

const facebookApiVersion = "v26.0";
const facebookOAuthScope = "pages_show_list,pages_read_engagement,pages_manage_posts";
const facebookCredentialsSettingKey = "stream.facebook_oauth_credentials";
const facebookConnectionSettingKeys: Record<RestreamTargetSlot, string> = {
  primary: "stream.facebook_oauth.primary",
  secondary: "stream.facebook_oauth.secondary"
};

export const facebookOAuthCookieName = "bouncecore_facebook_oauth";

export type FacebookOAuthState = {
  actorId: string;
  issuedAt: string;
  slot: RestreamTargetSlot;
  state: string;
};

export type FacebookRestreamRuntime = {
  lastAttemptAt: string | null;
  lastError: string | null;
  liveVideoId: string | null;
  secureStreamUrlCiphertext: string | null;
  sessionId: string | null;
  status: "idle" | "creating" | "live" | "complete" | "error";
  updatedAt: string;
};

export type FacebookRestreamConnectionRecord = {
  connectedAt: string;
  pageAccessTokenCiphertext: string;
  pageId: string;
  pageName: string;
  runtime: FacebookRestreamRuntime;
};

export type AdminFacebookOAuthCredentials = {
  appId: string;
  appSecretConfigured: boolean;
  configured: boolean;
  redirectUri: string | null;
  source: "admin" | "environment" | "missing";
};

export type AdminFacebookRestreamConnection = {
  connected: boolean;
  connectedAt: string | null;
  lastError: string | null;
  lastLiveVideoId: string | null;
  pageId: string | null;
  pageName: string | null;
  runtimeStatus: FacebookRestreamRuntime["status"];
};

type FacebookOAuthCredentialsInput = {
  appId: string;
  appSecret?: string;
  clearAppSecret?: boolean;
};

export type FacebookTokenResponse = {
  access_token?: string;
  error?: { message?: string };
  expires_in?: number;
  token_type?: string;
};

type FacebookPage = {
  access_token?: string;
  id?: string;
  name?: string;
  tasks?: string[];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function defaultFacebookRuntime(): FacebookRestreamRuntime {
  return {
    lastAttemptAt: null,
    lastError: null,
    liveVideoId: null,
    secureStreamUrlCiphertext: null,
    sessionId: null,
    status: "idle",
    updatedAt: new Date(0).toISOString()
  };
}

function normalizeRuntime(value: unknown): FacebookRestreamRuntime {
  const runtime = objectValue(value);
  const status = textValue(runtime.status);

  return {
    lastAttemptAt: textValue(runtime.lastAttemptAt) || null,
    lastError: textValue(runtime.lastError, 1000) || null,
    liveVideoId: textValue(runtime.liveVideoId) || null,
    secureStreamUrlCiphertext: textValue(runtime.secureStreamUrlCiphertext, 12000) || null,
    sessionId: textValue(runtime.sessionId) || null,
    status:
      status === "creating" || status === "live" || status === "complete" || status === "error"
        ? status
        : "idle",
    updatedAt: textValue(runtime.updatedAt) || new Date(0).toISOString()
  };
}

function normalizeConnection(value: unknown): FacebookRestreamConnectionRecord | null {
  const connection = objectValue(value);
  const connectedAt = textValue(connection.connectedAt);
  const pageAccessTokenCiphertext = textValue(connection.pageAccessTokenCiphertext, 12000);
  const pageId = textValue(connection.pageId, 100);
  const pageName = textValue(connection.pageName, 200);

  if (!connectedAt || !pageAccessTokenCiphertext || !pageId || !pageName) {
    return null;
  }

  return {
    connectedAt,
    pageAccessTokenCiphertext,
    pageId,
    pageName,
    runtime: normalizeRuntime(connection.runtime)
  };
}

async function storedCredentials() {
  const setting = await prisma.appSetting.findUnique({ where: { key: facebookCredentialsSettingKey } });
  const value = objectValue(setting?.value);

  return {
    appId: textValue(value.appId, 500),
    appSecretCiphertext: textValue(value.appSecretCiphertext, 12000)
  };
}

async function facebookOAuthCredentials() {
  const stored = await storedCredentials();

  if (stored.appId && stored.appSecretCiphertext) {
    return {
      appId: stored.appId,
      appSecret: decryptSecret(stored.appSecretCiphertext),
      source: "admin" as const
    };
  }

  const appId = process.env.FACEBOOK_APP_ID?.trim() ?? "";
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim() ?? "";

  if (appId && appSecret) {
    return { appId, appSecret, source: "environment" as const };
  }

  return { appId: stored.appId, appSecret: "", source: "missing" as const };
}

export async function getAdminFacebookOAuthCredentials(): Promise<AdminFacebookOAuthCredentials> {
  const credentials = await facebookOAuthCredentials();
  const origin = configuredAppOrigin();

  return {
    appId: credentials.appId,
    appSecretConfigured: Boolean(credentials.appSecret),
    configured: Boolean(credentials.appId && credentials.appSecret && secretEncryptionConfigured()),
    redirectUri: origin ? new URL("/admin/stream/facebook/callback", origin).toString() : null,
    source: credentials.source
  };
}

export async function updateFacebookOAuthCredentials(input: FacebookOAuthCredentialsInput, actorId: string) {
  const existing = await storedCredentials();
  const appId = textValue(input.appId, 500);
  const providedSecret = textValue(input.appSecret, 4000);
  let appSecretCiphertext = input.clearAppSecret ? "" : existing.appSecretCiphertext;

  if (providedSecret) {
    appSecretCiphertext = encryptSecret(providedSecret) ?? "";

    if (!appSecretCiphertext) {
      throw new Error("Push token encryption must be configured before a Meta app secret can be saved.");
    }
  }

  await prisma.appSetting.upsert({
    where: { key: facebookCredentialsSettingKey },
    update: {
      description: "Encrypted Meta app credentials for Facebook Live OAuth.",
      isSecret: true,
      value: { appId, appSecretCiphertext }
    },
    create: {
      description: "Encrypted Meta app credentials for Facebook Live OAuth.",
      isSecret: true,
      key: facebookCredentialsSettingKey,
      value: { appId, appSecretCiphertext }
    }
  });

  await writeAuditLog({
    action: "stream.facebook_oauth.credentials.update",
    actorId,
    metadata: {
      appIdConfigured: Boolean(appId),
      appSecretConfigured: Boolean(appSecretCiphertext)
    },
    severity: "warning",
    target: "stream:facebook-oauth"
  });
}

export function createFacebookOAuthState(actorId: string, slot: RestreamTargetSlot): FacebookOAuthState {
  return {
    actorId,
    issuedAt: new Date().toISOString(),
    slot,
    state: randomBytes(24).toString("base64url")
  };
}

export function encodeFacebookOAuthStateCookie(state: FacebookOAuthState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeFacebookOAuthStateCookie(value: string | undefined): FacebookOAuthState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<FacebookOAuthState>;
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

export function facebookOAuthRedirectUri(request: Request) {
  return appUrl(request, "/admin/stream/facebook/callback").toString();
}

export async function facebookAuthorizationUrl(request: Request, state: FacebookOAuthState) {
  const credentials = await facebookOAuthCredentials();

  if (!credentials.appId || !credentials.appSecret) {
    throw new Error("Configure the Meta app ID and secret before connecting a Facebook Page.");
  }

  if (!secretEncryptionConfigured()) {
    throw new Error("Push token encryption must be configured before connecting a Facebook Page.");
  }

  const url = new URL(`https://www.facebook.com/${facebookApiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", credentials.appId);
  url.searchParams.set("redirect_uri", facebookOAuthRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", facebookOAuthScope);
  url.searchParams.set("state", state.state);

  return url;
}

async function graphTokenRequest(params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${facebookApiVersion}/oauth/access_token`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as FacebookTokenResponse;

  if (!response.ok || body.error?.message || !body.access_token) {
    throw new Error(body.error?.message || "Facebook did not return an access token.");
  }

  return body;
}

export async function exchangeFacebookAuthorizationCode(request: Request, code: string) {
  const credentials = await facebookOAuthCredentials();
  const shortToken = await graphTokenRequest({
    client_id: credentials.appId,
    client_secret: credentials.appSecret,
    code,
    redirect_uri: facebookOAuthRedirectUri(request)
  });

  return graphTokenRequest({
    client_id: credentials.appId,
    client_secret: credentials.appSecret,
    fb_exchange_token: shortToken.access_token ?? "",
    grant_type: "fb_exchange_token"
  });
}

export async function facebookAppSecretProof(accessToken: string) {
  const credentials = await facebookOAuthCredentials();

  if (!credentials.appSecret) {
    throw new Error("Meta app credentials are not configured.");
  }

  return createHmac("sha256", credentials.appSecret).update(accessToken).digest("hex");
}

async function authorizedFacebookPages(userAccessToken: string) {
  const pages: FacebookPage[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/${facebookApiVersion}/me/accounts?fields=id,name,access_token,tasks&limit=100`;

  for (let page = 0; page < 5 && nextUrl; page += 1) {
    const proof = await facebookAppSecretProof(userAccessToken);
    const url = new URL(nextUrl);
    url.searchParams.set("appsecret_proof", proof);
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${userAccessToken}` }
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: FacebookPage[];
      error?: { message?: string };
      paging?: { next?: string };
    };

    if (!response.ok) {
      throw new Error(body.error?.message || "Facebook Pages could not be read.");
    }

    pages.push(...(body.data ?? []));
    nextUrl = body.paging?.next ?? null;
  }

  return pages.filter((page) => page.id && page.name && page.access_token);
}

export async function completeFacebookOAuth({
  actorId,
  preferredPageId,
  slot,
  token
}: {
  actorId: string;
  preferredPageId?: string;
  slot: RestreamTargetSlot;
  token: FacebookTokenResponse;
}) {
  if (!token.access_token) {
    throw new Error("Facebook did not return a usable access token.");
  }

  const pages = await authorizedFacebookPages(token.access_token);
  const requestedPageId = textValue(preferredPageId, 100);
  const selected = requestedPageId ? pages.find((page) => page.id === requestedPageId) : pages.length === 1 ? pages[0] : null;

  if (!selected?.id || !selected.name || !selected.access_token) {
    if (!pages.length) {
      throw new Error("No Facebook Pages managed by this account were returned. Check the granted Page permissions.");
    }

    const choices = pages.slice(0, 10).map((page) => `${page.name} (${page.id})`).join(", ");
    throw new Error(
      requestedPageId
        ? `Facebook Page ${requestedPageId} was not available to this account. Available Pages: ${choices}`
        : `Enter and save a Facebook Page ID before connecting. Available Pages: ${choices}`
    );
  }

  const pageAccessTokenCiphertext = encryptSecret(selected.access_token);

  if (!pageAccessTokenCiphertext) {
    throw new Error("The Facebook Page token could not be stored securely.");
  }

  const value: FacebookRestreamConnectionRecord = {
    connectedAt: new Date().toISOString(),
    pageAccessTokenCiphertext,
    pageId: selected.id,
    pageName: selected.name,
    runtime: defaultFacebookRuntime()
  };

  await prisma.appSetting.upsert({
    where: { key: facebookConnectionSettingKeys[slot] },
    update: {
      description: `Encrypted Facebook Page connection for restream ${slot}.`,
      isSecret: true,
      value: value as unknown as Prisma.InputJsonValue
    },
    create: {
      description: `Encrypted Facebook Page connection for restream ${slot}.`,
      isSecret: true,
      key: facebookConnectionSettingKeys[slot],
      value: value as unknown as Prisma.InputJsonValue
    }
  });

  await writeAuditLog({
    action: "stream.facebook_oauth.connect",
    actorId,
    metadata: { pageId: selected.id, pageName: selected.name, slot },
    severity: "warning",
    target: `stream:restream:${slot}`
  });

  return value;
}

export async function getFacebookRestreamConnectionRecord(slot: RestreamTargetSlot) {
  const setting = await prisma.appSetting.findUnique({ where: { key: facebookConnectionSettingKeys[slot] } });
  return normalizeConnection(setting?.value);
}

export async function getAdminFacebookRestreamConnection(
  slot: RestreamTargetSlot
): Promise<AdminFacebookRestreamConnection> {
  const connection = await getFacebookRestreamConnectionRecord(slot);

  return {
    connected: Boolean(connection),
    connectedAt: connection?.connectedAt ?? null,
    lastError: connection?.runtime.lastError ?? null,
    lastLiveVideoId: connection?.runtime.liveVideoId ?? null,
    pageId: connection?.pageId ?? null,
    pageName: connection?.pageName ?? null,
    runtimeStatus: connection?.runtime.status ?? "idle"
  };
}

export async function getFacebookPageAccess(slot: RestreamTargetSlot) {
  const connection = await getFacebookRestreamConnectionRecord(slot);

  if (!connection) {
    throw new Error("Connect a Facebook Page before enabling automatic Facebook Live broadcasts.");
  }

  return {
    connection,
    pageAccessToken: decryptSecret(connection.pageAccessTokenCiphertext)
  };
}

export async function getActiveFacebookRestreamTargetUrl(slot: RestreamTargetSlot) {
  const connection = await getFacebookRestreamConnectionRecord(slot);
  const runtime = connection?.runtime;

  if (!runtime?.sessionId || runtime.status !== "live" || !runtime.secureStreamUrlCiphertext) {
    return null;
  }

  const openSession = await prisma.streamSession.findFirst({
    orderBy: { startedAt: "desc" },
    select: { id: true },
    where: { endedAt: null }
  });

  if (openSession?.id !== runtime.sessionId) {
    return null;
  }

  return decryptSecret(runtime.secureStreamUrlCiphertext);
}

export async function updateFacebookRestreamRuntime(slot: RestreamTargetSlot, runtime: FacebookRestreamRuntime) {
  const connection = await getFacebookRestreamConnectionRecord(slot);

  if (!connection) {
    throw new Error("The Facebook Page connection no longer exists.");
  }

  await prisma.appSetting.update({
    data: { value: { ...connection, runtime } as unknown as Prisma.InputJsonValue },
    where: { key: facebookConnectionSettingKeys[slot] }
  });
}

export async function disconnectFacebookRestream(slot: RestreamTargetSlot, actorId: string) {
  await prisma.appSetting.deleteMany({ where: { key: facebookConnectionSettingKeys[slot] } });

  await writeAuditLog({
    action: "stream.facebook_oauth.disconnect",
    actorId,
    metadata: { slot },
    severity: "warning",
    target: `stream:restream:${slot}`
  });
}
