import { writeAuditLog } from "@/lib/auth/audit";
import { encryptSecret } from "@/lib/security/secret-crypto";
import {
  facebookAppSecretProof,
  getFacebookPageAccess,
  getFacebookRestreamConnectionRecord,
  updateFacebookRestreamRuntime,
  type FacebookRestreamRuntime
} from "@/lib/stream/facebook-restream-oauth";
import { buildRestreamTargetUrl, restreamTargetSlots, type RestreamTargetSlot } from "@/lib/stream/restream-settings";
import { getRestreamSettings } from "@/lib/stream/restream-settings-service";

const facebookApiBase = "https://graph.facebook.com/v26.0";
const retryDelayMs = 20_000;

type FacebookApiErrorBody = {
  error?: { message?: string };
};

export type FacebookRestreamSyncResult = {
  detail: string;
  liveVideoId: string | null;
  pageName: string | null;
  slot: RestreamTargetSlot;
  status: "disabled" | "not-facebook" | "not-connected" | "waiting" | "live" | "complete" | "error";
};

function runtimeForSession(
  sessionId: string,
  overrides: Partial<FacebookRestreamRuntime> = {}
): FacebookRestreamRuntime {
  return {
    lastAttemptAt: null,
    lastError: null,
    liveVideoId: null,
    secureStreamUrlCiphertext: null,
    sessionId,
    status: "idle",
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function retryIsDue(runtime: FacebookRestreamRuntime) {
  if (!runtime.lastAttemptAt) {
    return true;
  }

  const lastAttemptAt = new Date(runtime.lastAttemptAt).getTime();
  return !Number.isFinite(lastAttemptAt) || Date.now() - lastAttemptAt >= retryDelayMs;
}

async function facebookApiRequest<T>(
  path: string,
  pageAccessToken: string,
  params: Record<string, string>,
  method = "POST"
): Promise<T> {
  const body = new URLSearchParams({
    ...params,
    appsecret_proof: await facebookAppSecretProof(pageAccessToken)
  });
  const response = await fetch(`${facebookApiBase}${path}`, {
    body: method === "GET" ? undefined : body,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${pageAccessToken}`,
      ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded" })
    },
    method
  });
  const responseBody = (await response.json().catch(() => ({}))) as T & FacebookApiErrorBody;

  if (!response.ok || responseBody.error?.message) {
    throw new Error(responseBody.error?.message || `Facebook Live API returned HTTP ${response.status}.`);
  }

  return responseBody;
}

async function createFacebookLiveVideo(
  slot: RestreamTargetSlot,
  sessionId: string,
  title: string,
  description: string
): Promise<FacebookRestreamSyncResult> {
  const { connection, pageAccessToken } = await getFacebookPageAccess(slot);
  const lastAttemptAt = new Date().toISOString();

  await updateFacebookRestreamRuntime(
    slot,
    runtimeForSession(sessionId, {
      lastAttemptAt,
      status: "creating",
      updatedAt: lastAttemptAt
    })
  );

  const response = await facebookApiRequest<{
    id?: string;
    secure_stream_url?: string;
  }>(`/${encodeURIComponent(connection.pageId)}/live_videos`, pageAccessToken, {
    description,
    status: "LIVE_NOW",
    title
  });

  if (!response.id || !response.secure_stream_url) {
    throw new Error("Facebook created the live video without returning a secure stream URL.");
  }

  const secureStreamUrl = buildRestreamTargetUrl({
    broadcastDescription: "",
    broadcastTitle: "",
    enabled: true,
    facebookPageId: connection.pageId,
    label: connection.pageName,
    provider: "facebook",
    serverUrl: response.secure_stream_url,
    streamKey: ""
  });
  const secureStreamUrlCiphertext = secureStreamUrl ? encryptSecret(secureStreamUrl) : null;

  if (!secureStreamUrlCiphertext) {
    throw new Error("Facebook's secure stream URL could not be stored safely.");
  }

  const runtime = runtimeForSession(sessionId, {
    lastAttemptAt,
    liveVideoId: response.id,
    secureStreamUrlCiphertext,
    status: "live",
    updatedAt: new Date().toISOString()
  });
  await updateFacebookRestreamRuntime(slot, runtime);

  await writeAuditLog({
    action: "stream.facebook_live.create",
    actorId: null,
    metadata: {
      liveVideoId: response.id,
      pageId: connection.pageId,
      pageName: connection.pageName,
      sessionId,
      slot
    },
    severity: "info",
    target: `stream-session:${sessionId}`
  });

  return {
    detail: `Facebook Live created for ${connection.pageName}; the secure relay will start automatically.`,
    liveVideoId: response.id,
    pageName: connection.pageName,
    slot,
    status: "live"
  };
}

export async function syncFacebookRestream(input: {
  channelTitle: string;
  hostDisplayName: string | null;
  sessionId: string;
  slot: RestreamTargetSlot;
}): Promise<FacebookRestreamSyncResult> {
  const settings = await getRestreamSettings(input.slot);

  if (!settings.enabled) {
    return { detail: "Restream output is disabled.", liveVideoId: null, pageName: null, slot: input.slot, status: "disabled" };
  }

  if (settings.provider !== "facebook") {
    return { detail: "Restream output is not Facebook.", liveVideoId: null, pageName: null, slot: input.slot, status: "not-facebook" };
  }

  const connection = await getFacebookRestreamConnectionRecord(input.slot);

  if (!connection) {
    return {
      detail: "No Facebook Page connection is configured; the saved manual RTMPS target remains available.",
      liveVideoId: null,
      pageName: null,
      slot: input.slot,
      status: "not-connected"
    };
  }

  const runtime = connection.runtime;

  if (runtime.sessionId === input.sessionId && runtime.status === "live" && runtime.liveVideoId) {
    return {
      detail: `Facebook Live is active on ${connection.pageName}.`,
      liveVideoId: runtime.liveVideoId,
      pageName: connection.pageName,
      slot: input.slot,
      status: "live"
    };
  }

  if (runtime.sessionId === input.sessionId && runtime.status === "creating" && !retryIsDue(runtime)) {
    return {
      detail: "Facebook Live creation is already in progress.",
      liveVideoId: runtime.liveVideoId,
      pageName: connection.pageName,
      slot: input.slot,
      status: "waiting"
    };
  }

  if (runtime.sessionId === input.sessionId && runtime.status === "error" && !retryIsDue(runtime)) {
    return {
      detail: runtime.lastError ?? "Facebook Live creation will retry shortly.",
      liveVideoId: runtime.liveVideoId,
      pageName: connection.pageName,
      slot: input.slot,
      status: "waiting"
    };
  }

  try {
    const fallbackTitle = input.hostDisplayName
      ? `${input.channelTitle} - ${input.hostDisplayName}`
      : input.channelTitle;
    const broadcastTitle = settings.broadcastTitle || fallbackTitle;
    const broadcastDescription = settings.broadcastDescription || `${broadcastTitle} is live now on Bouncecore.`;

    return await createFacebookLiveVideo(
      input.slot,
      input.sessionId,
      broadcastTitle,
      broadcastDescription
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook Live creation failed.";
    const failedRuntime = runtimeForSession(input.sessionId, {
      lastAttemptAt: new Date().toISOString(),
      lastError: message,
      status: "error",
      updatedAt: new Date().toISOString()
    });

    await updateFacebookRestreamRuntime(input.slot, failedRuntime).catch(() => undefined);
    await writeAuditLog({
      action: "stream.facebook_live.create_failed",
      actorId: null,
      metadata: { error: message, sessionId: input.sessionId, slot: input.slot },
      severity: "warning",
      target: `stream-session:${input.sessionId}`
    });

    return {
      detail: message,
      liveVideoId: null,
      pageName: connection.pageName,
      slot: input.slot,
      status: "error"
    };
  }
}

export async function syncFacebookRestreams(input: {
  channelTitle: string;
  hostDisplayName: string | null;
  sessionId: string;
}) {
  const settled = await Promise.allSettled(
    restreamTargetSlots.map((slot) => syncFacebookRestream({ ...input, slot }))
  );

  return settled.map((result, index): FacebookRestreamSyncResult =>
    result.status === "fulfilled"
      ? result.value
      : {
          detail: result.reason instanceof Error ? result.reason.message : "Facebook Live synchronization failed.",
          liveVideoId: null,
          pageName: null,
          slot: restreamTargetSlots[index],
          status: "error"
        }
  );
}

async function finishFacebookRestream(slot: RestreamTargetSlot): Promise<FacebookRestreamSyncResult> {
  const connection = await getFacebookRestreamConnectionRecord(slot);
  const runtime = connection?.runtime;

  if (!connection || !runtime?.liveVideoId || (runtime.status !== "live" && runtime.status !== "creating")) {
    return {
      detail: "No active Facebook Live broadcast to finish.",
      liveVideoId: runtime?.liveVideoId ?? null,
      pageName: connection?.pageName ?? null,
      slot,
      status: "complete"
    };
  }

  const { pageAccessToken } = await getFacebookPageAccess(slot);
  const liveVideoId = runtime.liveVideoId;

  try {
    await facebookApiRequest(`/${encodeURIComponent(liveVideoId)}`, pageAccessToken, { end_live_video: "true" });
    await updateFacebookRestreamRuntime(slot, {
      ...runtime,
      lastError: null,
      secureStreamUrlCiphertext: null,
      status: "complete",
      updatedAt: new Date().toISOString()
    });

    return {
      detail: `Facebook Live ended on ${connection.pageName}.`,
      liveVideoId,
      pageName: connection.pageName,
      slot,
      status: "complete"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook Live could not be ended through the API.";

    await updateFacebookRestreamRuntime(slot, {
      ...runtime,
      lastError: message,
      secureStreamUrlCiphertext: null,
      status: "error",
      updatedAt: new Date().toISOString()
    }).catch(() => undefined);

    return { detail: message, liveVideoId, pageName: connection.pageName, slot, status: "error" };
  }
}

export async function finishFacebookRestreams() {
  const settled = await Promise.allSettled(restreamTargetSlots.map((slot) => finishFacebookRestream(slot)));

  return settled.map((result, index): FacebookRestreamSyncResult =>
    result.status === "fulfilled"
      ? result.value
      : {
          detail: result.reason instanceof Error ? result.reason.message : "Facebook Live finalization failed.",
          liveVideoId: null,
          pageName: null,
          slot: restreamTargetSlots[index],
          status: "error"
        }
  );
}
