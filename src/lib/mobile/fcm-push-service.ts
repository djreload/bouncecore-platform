import { createSign } from "node:crypto";

const fcmScope = "https://www.googleapis.com/auth/firebase.messaging";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";

type FcmOAuthToken = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  token_type?: string;
};

type FcmSendResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  name?: string;
};

let cachedAccessToken: {
  expiresAt: number;
  value: string;
} | null = null;

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function compactMessage(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function fcmPrivateKey() {
  return envValue("FCM_CLIENT_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export function fcmDispatchConfigured() {
  return Boolean(envValue("FCM_PROJECT_ID") && envValue("FCM_CLIENT_EMAIL") && fcmPrivateKey());
}

export function fcmDispatchConfigStatus() {
  return {
    clientEmailConfigured: Boolean(envValue("FCM_CLIENT_EMAIL")),
    privateKeyConfigured: Boolean(fcmPrivateKey()),
    projectIdConfigured: Boolean(envValue("FCM_PROJECT_ID"))
  };
}

function serviceAccountJwt(nowSeconds: number) {
  const clientEmail = envValue("FCM_CLIENT_EMAIL");
  const privateKey = fcmPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("FCM_CLIENT_EMAIL and FCM_CLIENT_PRIVATE_KEY are required for Firebase Cloud Messaging.");
  }

  const unsignedToken = [
    base64UrlJson({
      alg: "RS256",
      typ: "JWT"
    }),
    base64UrlJson({
      aud: googleTokenEndpoint,
      exp: nowSeconds + 3600,
      iat: nowSeconds,
      iss: clientEmail,
      scope: fcmScope
    })
  ].join(".");
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey, "base64url");

  return `${unsignedToken}.${signature}`;
}

async function getFcmAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.value;
  }

  const response = await fetch(googleTokenEndpoint, {
    body: new URLSearchParams({
      assertion: serviceAccountJwt(now),
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST",
    signal: AbortSignal.timeout(10000)
  });
  const payload = (await response.json().catch(() => ({}))) as FcmOAuthToken;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? `FCM OAuth request failed with HTTP ${response.status}.`);
  }

  cachedAccessToken = {
    expiresAt: now + (payload.expires_in ?? 3600),
    value: payload.access_token
  };

  return payload.access_token;
}

export function buildFcmMessage(input: {
  actionUrl?: string | null;
  body: string | null;
  deliveryId: string;
  notificationId: string;
  title: string;
  token: string;
  type: string;
}) {
  return {
    message: {
      android: {
        notification: {
          channel_id: "bouncecore_notifications",
          sound: "default"
        },
        priority: "HIGH"
      },
      data: {
        actionUrl: input.actionUrl ?? "",
        deliveryId: input.deliveryId,
        notificationId: input.notificationId,
        type: input.type
      },
      notification: {
        body: compactMessage(input.body, 1024),
        title: compactMessage(input.title, 120)
      },
      token: input.token
    }
  };
}

function fcmErrorCode(payload: FcmSendResponse, statusCode: number) {
  return payload.error?.status ?? `http_${statusCode}`;
}

function fcmErrorMessage(payload: FcmSendResponse, statusCode: number) {
  return payload.error?.message ?? `FCM push request failed with HTTP ${statusCode}.`;
}

export async function sendFcmPush(input: {
  actionUrl?: string | null;
  body: string | null;
  deliveryId: string;
  notificationId: string;
  title: string;
  token: string;
  type: string;
}) {
  const projectId = envValue("FCM_PROJECT_ID");

  if (!projectId) {
    throw new Error("FCM_PROJECT_ID is required for Firebase Cloud Messaging.");
  }

  const accessToken = await getFcmAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    body: JSON.stringify(buildFcmMessage(input)),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST",
    signal: AbortSignal.timeout(10000)
  });
  const payload = (await response.json().catch(() => ({}))) as FcmSendResponse;

  if (!response.ok || !payload.name) {
    return {
      errorCode: fcmErrorCode(payload, response.status),
      errorMessage: fcmErrorMessage(payload, response.status),
      ok: false as const
    };
  }

  return {
    ok: true as const,
    providerMessageId: payload.name
  };
}

export function fcmErrorMeansDeviceRevoked(errorCode: string | null | undefined) {
  return errorCode === "UNREGISTERED" || errorCode === "SENDER_ID_MISMATCH" || errorCode === "NOT_FOUND";
}
