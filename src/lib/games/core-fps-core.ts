import { createHmac, timingSafeEqual } from "node:crypto";

export const coreFpsSourceRepository = "https://github.com/djreload/core";
export const coreFpsSourceRef = "2ed2b492d5491dfaf41fb883e6646c666e0f6035";
export const coreFpsTicketAudience = "bouncecore-core-fps";
export const coreFpsTicketLifetimeSeconds = 2 * 60 * 60;

export type CoreFpsTicketClaims = {
  aud: typeof coreFpsTicketAudience;
  exp: number;
  iat: number;
  lid: string;
  name: string;
  player: string;
  sid: string;
  sub: string;
  v: 3;
};

type CoreFpsTicketInput = {
  displayName: string;
  lobbyId: string;
  now?: Date;
  playerName: string;
  secret: string;
  sessionId: string;
  userId: string;
};

function normalizedSecret(secret: string) {
  const value = secret.trim();

  if (value.length < 32) {
    throw new Error("CORE_FPS_TICKET_SECRET must contain at least 32 characters.");
  }

  return value;
}

function normalizeClaimText(value: string, maxLength: number, label: string) {
  const text = value.trim().replace(/\s+/g, " ");

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text.slice(0, maxLength);
}

function signatureForPayload(payload: string, secret: string) {
  return createHmac("sha256", normalizedSecret(secret)).update(payload).digest("base64url");
}

function signaturesMatch(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function normalizeCoreFpsPublicUrl(value: string | null | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(text);
  } catch {
    throw new Error("Core FPS public URL must be a valid absolute URL.");
  }

  const isLocalHttp =
    parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname.toLowerCase());

  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Core FPS public URL must use HTTPS outside local development.");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Core FPS public URL cannot contain credentials, query parameters, or a fragment.");
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return parsed.toString().replace(/\/$/, "");
}

export function assertIsolatedCoreFpsOrigin(publicUrl: string, appUrl: string | null | undefined) {
  const normalizedPublicUrl = normalizeCoreFpsPublicUrl(publicUrl);
  const appText = appUrl?.trim() ?? "";

  if (!normalizedPublicUrl || !appText) {
    return normalizedPublicUrl;
  }

  let appOrigin: string;

  try {
    appOrigin = new URL(appText).origin;
  } catch {
    return normalizedPublicUrl;
  }

  if (new URL(normalizedPublicUrl).origin === appOrigin) {
    throw new Error("Core FPS must use a separate origin from the main Bouncecore application.");
  }

  return normalizedPublicUrl;
}

export function createCoreFpsTicket({
  displayName,
  lobbyId,
  now = new Date(),
  playerName,
  secret,
  sessionId,
  userId
}: CoreFpsTicketInput) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims: CoreFpsTicketClaims = {
    aud: coreFpsTicketAudience,
    exp: issuedAt + coreFpsTicketLifetimeSeconds,
    iat: issuedAt,
    lid: normalizeClaimText(lobbyId, 120, "Lobby ID"),
    name: normalizeClaimText(displayName, 60, "Display name"),
    player: normalizeClaimText(playerName, 15, "Player name"),
    sid: normalizeClaimText(sessionId, 120, "Session ID"),
    sub: normalizeClaimText(userId, 120, "User ID"),
    v: 3
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");

  return `${payload}.${signatureForPayload(payload, secret)}`;
}

export function verifyCoreFpsTicket(ticket: string, secret: string, now = new Date()) {
  const [payload, signature, extra] = ticket.trim().split(".");

  if (!payload || !signature || extra || !signaturesMatch(signature, signatureForPayload(payload, secret))) {
    throw new Error("Core FPS ticket is invalid.");
  }

  let claims: unknown;

  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Core FPS ticket payload is invalid.");
  }

  if (
    !claims ||
    typeof claims !== "object" ||
    (claims as CoreFpsTicketClaims).aud !== coreFpsTicketAudience ||
    (claims as CoreFpsTicketClaims).v !== 3 ||
    typeof (claims as CoreFpsTicketClaims).sub !== "string" ||
    typeof (claims as CoreFpsTicketClaims).name !== "string" ||
    typeof (claims as CoreFpsTicketClaims).lid !== "string" ||
    typeof (claims as CoreFpsTicketClaims).player !== "string" ||
    typeof (claims as CoreFpsTicketClaims).sid !== "string" ||
    typeof (claims as CoreFpsTicketClaims).iat !== "number" ||
    typeof (claims as CoreFpsTicketClaims).exp !== "number"
  ) {
    throw new Error("Core FPS ticket claims are invalid.");
  }

  const typedClaims = claims as CoreFpsTicketClaims;
  const currentTime = Math.floor(now.getTime() / 1000);

  if (typedClaims.iat > currentTime + 60 || typedClaims.exp <= currentTime || typedClaims.exp - typedClaims.iat > coreFpsTicketLifetimeSeconds) {
    throw new Error("Core FPS ticket has expired or has invalid timing.");
  }

  return typedClaims;
}

export function buildCoreFpsLaunchUrl(
  publicUrl: string,
  ticket: string,
  playerName: string,
  bootstrapMapName?: string | null
) {
  const launchUrl = new URL(`${normalizeCoreFpsPublicUrl(publicUrl)}/`);
  const safePlayerName = normalizeClaimText(playerName, 15, "Player name");
  const safeMapName = bootstrapMapName?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") ?? "";
  launchUrl.searchParams.set("ticket", ticket);
  launchUrl.searchParams.set(
    "cmd",
    `name ${safePlayerName}; join lobby`
  );
  if (safeMapName) {
    launchUrl.searchParams.set("lobbyMap", safeMapName);
  }

  return launchUrl.toString();
}

export function createCoreFpsRuntimePlayerName(displayName: string, sessionId: string) {
  const readable = displayName.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "Player";
  const suffix = sessionId.replace(/[^a-z0-9]/gi, "").slice(-6);

  return `${readable}-${suffix}`.slice(0, 15);
}

export function secretsMatch(provided: string, expected: string) {
  if (!provided || !expected) {
    return false;
  }

  return signaturesMatch(provided, expected);
}
