import { createHmac, timingSafeEqual } from "node:crypto";

export const coreFpsSourceRepository = "https://github.com/djreload/core";
export const coreFpsSourceRef = "2ed2b492d5491dfaf41fb883e6646c666e0f6035";
export const coreFpsTicketAudience = "bouncecore-core-fps";
export const coreFpsTicketLifetimeSeconds = 2 * 60 * 60;

export type CoreFpsTicketClaims = {
  aud: typeof coreFpsTicketAudience;
  exp: number;
  iat: number;
  name: string;
  sub: string;
  v: 1;
};

type CoreFpsTicketInput = {
  displayName: string;
  now?: Date;
  secret: string;
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
  now = new Date(),
  secret,
  userId
}: CoreFpsTicketInput) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims: CoreFpsTicketClaims = {
    aud: coreFpsTicketAudience,
    exp: issuedAt + coreFpsTicketLifetimeSeconds,
    iat: issuedAt,
    name: normalizeClaimText(displayName, 60, "Display name"),
    sub: normalizeClaimText(userId, 120, "User ID"),
    v: 1
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
    (claims as CoreFpsTicketClaims).v !== 1 ||
    typeof (claims as CoreFpsTicketClaims).sub !== "string" ||
    typeof (claims as CoreFpsTicketClaims).name !== "string" ||
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

export function buildCoreFpsLaunchUrl(publicUrl: string, ticket: string) {
  const launchUrl = new URL(`${normalizeCoreFpsPublicUrl(publicUrl)}/`);
  launchUrl.searchParams.set("ticket", ticket);

  return launchUrl.toString();
}

export function secretsMatch(provided: string, expected: string) {
  if (!provided || !expected) {
    return false;
  }

  return signaturesMatch(provided, expected);
}
