import { writeAuditLog } from "@/lib/auth/audit";
import { getRestreamSettings } from "@/lib/stream/restream-settings-service";
import { restreamTargetSlots, type RestreamTargetSlot } from "@/lib/stream/restream-settings";
import {
  getYouTubeAccessToken,
  getYouTubeRestreamConnectionRecord,
  updateYouTubeRestreamRuntime,
  type YouTubeRestreamRuntime
} from "@/lib/stream/youtube-restream-oauth";

const youtubeApiBase = "https://www.googleapis.com/youtube/v3";
const retryDelayMs = 20_000;

type YouTubeApiErrorBody = {
  error?: {
    message?: string;
  };
};

type YouTubeLiveStream = {
  cdn?: {
    ingestionInfo?: {
      streamName?: string;
    };
  };
  id?: string;
  status?: {
    streamStatus?: string;
  };
};

type YouTubeLiveBroadcast = {
  id?: string;
  status?: {
    lifeCycleStatus?: string;
    privacyStatus?: string;
  };
};

export type YouTubeRestreamSyncResult = {
  broadcastId: string | null;
  channelTitle: string | null;
  detail: string;
  slot: RestreamTargetSlot;
  status: "disabled" | "not-youtube" | "not-connected" | "waiting" | "bound" | "live" | "error";
};

function runtimeForSession(sessionId: string, overrides: Partial<YouTubeRestreamRuntime> = {}): YouTubeRestreamRuntime {
  return {
    broadcastId: null,
    lastAttemptAt: null,
    lastError: null,
    sessionId,
    status: "idle",
    streamId: null,
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function apiUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${youtubeApiBase}${path}`);

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  return url;
}

async function youtubeApiRequest<T>(accessToken: string, url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });
  const body = (await response.json().catch(() => ({}))) as T & YouTubeApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error?.message || `YouTube Live API returned HTTP ${response.status}.`);
  }

  return body;
}

async function findYouTubeStreamByKey(accessToken: string, streamKey: string) {
  let pageToken = "";

  for (let page = 0; page < 5; page += 1) {
    const params: Record<string, string> = {
      maxResults: "50",
      mine: "true",
      part: "id,cdn,status"
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const body = await youtubeApiRequest<{
      items?: YouTubeLiveStream[];
      nextPageToken?: string;
    }>(accessToken, apiUrl("/liveStreams", params));
    const stream = body.items?.find((item) => item.cdn?.ingestionInfo?.streamName === streamKey);

    if (stream?.id) {
      return stream;
    }

    pageToken = body.nextPageToken ?? "";

    if (!pageToken) {
      break;
    }
  }

  return null;
}

async function readYouTubeStream(accessToken: string, streamId: string) {
  const body = await youtubeApiRequest<{ items?: YouTubeLiveStream[] }>(
    accessToken,
    apiUrl("/liveStreams", {
      id: streamId,
      part: "id,status"
    })
  );

  return body.items?.[0] ?? null;
}

async function readYouTubeBroadcast(accessToken: string, broadcastId: string) {
  const body = await youtubeApiRequest<{ items?: YouTubeLiveBroadcast[] }>(
    accessToken,
    apiUrl("/liveBroadcasts", {
      id: broadcastId,
      part: "id,status"
    })
  );

  return body.items?.[0] ?? null;
}

async function createPublicBroadcast(accessToken: string, title: string, description: string) {
  return youtubeApiRequest<YouTubeLiveBroadcast>(
    accessToken,
    apiUrl("/liveBroadcasts", {
      part: "id,snippet,status,contentDetails"
    }),
    {
      body: JSON.stringify({
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          enableDvr: true,
          enableEmbed: true,
          monitorStream: {
            broadcastStreamDelayMs: 0,
            enableMonitorStream: false
          },
          recordFromStart: true
        },
        snippet: {
          description: description.slice(0, 5000),
          scheduledStartTime: new Date(Date.now() + 10_000).toISOString(),
          title: title.slice(0, 100)
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false
        }
      }),
      method: "POST"
    }
  );
}

async function bindBroadcast(accessToken: string, broadcastId: string, streamId: string) {
  await youtubeApiRequest(
    accessToken,
    apiUrl("/liveBroadcasts/bind", {
      id: broadcastId,
      part: "id,status,contentDetails",
      streamId
    }),
    {
      method: "POST"
    }
  );
}

async function transitionBroadcast(accessToken: string, broadcastId: string, status: "live" | "complete") {
  await youtubeApiRequest(
    accessToken,
    apiUrl("/liveBroadcasts/transition", {
      broadcastStatus: status,
      id: broadcastId,
      part: "id,status"
    }),
    {
      method: "POST"
    }
  );
}

function retryIsDue(runtime: YouTubeRestreamRuntime) {
  if (!runtime.lastAttemptAt) {
    return true;
  }

  const lastAttemptAt = new Date(runtime.lastAttemptAt).getTime();

  return !Number.isFinite(lastAttemptAt) || Date.now() - lastAttemptAt >= retryDelayMs;
}

async function progressBoundBroadcast(
  slot: RestreamTargetSlot,
  accessToken: string,
  runtime: YouTubeRestreamRuntime
): Promise<YouTubeRestreamSyncResult> {
  if (!runtime.broadcastId || !runtime.streamId) {
    throw new Error("YouTube broadcast state is missing its stream binding.");
  }

  const [broadcast, stream] = await Promise.all([
    readYouTubeBroadcast(accessToken, runtime.broadcastId),
    readYouTubeStream(accessToken, runtime.streamId)
  ]);
  const lifecycle = broadcast?.status?.lifeCycleStatus ?? "unknown";

  if (lifecycle === "live" || lifecycle === "liveStarting") {
    const nextRuntime = runtimeForSession(runtime.sessionId ?? "", {
      ...runtime,
      lastError: null,
      status: "live",
      updatedAt: new Date().toISOString()
    });
    await updateYouTubeRestreamRuntime(slot, nextRuntime);

    return {
      broadcastId: runtime.broadcastId,
      channelTitle: null,
      detail: lifecycle === "live" ? "Public YouTube broadcast is live." : "Public YouTube broadcast is starting.",
      slot,
      status: "live"
    };
  }

  if (lifecycle === "complete") {
    await updateYouTubeRestreamRuntime(
      slot,
      runtimeForSession(runtime.sessionId ?? "", {
        ...runtime,
        lastError: null,
        status: "complete",
        updatedAt: new Date().toISOString()
      })
    );

    return {
      broadcastId: runtime.broadcastId,
      channelTitle: null,
      detail: "YouTube broadcast completed.",
      slot,
      status: "waiting"
    };
  }

  if (stream?.status?.streamStatus !== "active") {
    return {
      broadcastId: runtime.broadcastId,
      channelTitle: null,
      detail: "Waiting for YouTube to receive the restream feed.",
      slot,
      status: "bound"
    };
  }

  await transitionBroadcast(accessToken, runtime.broadcastId, "live");
  await updateYouTubeRestreamRuntime(
    slot,
    runtimeForSession(runtime.sessionId ?? "", {
      ...runtime,
      lastError: null,
      status: "live",
      updatedAt: new Date().toISOString()
    })
  );

  return {
    broadcastId: runtime.broadcastId,
    channelTitle: null,
    detail: "YouTube accepted the public go-live transition.",
    slot,
    status: "live"
  };
}

async function syncYouTubeSlot({
  channelTitle,
  hostDisplayName,
  sessionId,
  slot
}: {
  channelTitle: string;
  hostDisplayName: string | null;
  sessionId: string;
  slot: RestreamTargetSlot;
}): Promise<YouTubeRestreamSyncResult> {
  const settings = await getRestreamSettings(slot);

  if (!settings.enabled) {
    return { broadcastId: null, channelTitle: null, detail: "Restream output is disabled.", slot, status: "disabled" };
  }

  if (settings.provider !== "youtube") {
    return { broadcastId: null, channelTitle: null, detail: "Restream output is not YouTube.", slot, status: "not-youtube" };
  }

  const connection = await getYouTubeRestreamConnectionRecord(slot);

  if (!connection) {
    return {
      broadcastId: null,
      channelTitle: null,
      detail: "Connect the destination's YouTube channel in Admin -> Stream.",
      slot,
      status: "not-connected"
    };
  }

  let runtime = connection.runtime;

  try {
    if (runtime.sessionId === sessionId && runtime.broadcastId && runtime.streamId && runtime.status === "live") {
      return {
        broadcastId: runtime.broadcastId,
        channelTitle: connection.channelTitle,
        detail: "Public YouTube broadcast is live.",
        slot,
        status: "live"
      };
    }

    const accessToken = await getYouTubeAccessToken(slot);

    if (runtime.sessionId === sessionId && runtime.broadcastId && runtime.streamId) {
      const progress = await progressBoundBroadcast(slot, accessToken, runtime);

      return {
        ...progress,
        channelTitle: connection.channelTitle
      };
    }

    if (runtime.sessionId && runtime.sessionId !== sessionId && runtime.broadcastId && runtime.status === "live") {
      await transitionBroadcast(accessToken, runtime.broadcastId, "complete").catch(() => undefined);
    }

    if (runtime.sessionId !== sessionId) {
      runtime = runtimeForSession(sessionId);
    }

    if (!retryIsDue(runtime)) {
      return {
        broadcastId: runtime.broadcastId,
        channelTitle: connection.channelTitle,
        detail: "YouTube automatic publish is waiting to retry.",
        slot,
        status: "waiting"
      };
    }

    runtime = runtimeForSession(sessionId, {
      ...runtime,
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
      status: "creating",
      updatedAt: new Date().toISOString()
    });
    await updateYouTubeRestreamRuntime(slot, runtime);

    const stream = await findYouTubeStreamByKey(accessToken, settings.streamKey);

    if (!stream?.id) {
      throw new Error("The saved stream key was not found on the connected YouTube channel.");
    }

    const fallbackTitle = hostDisplayName ? `${channelTitle} - ${hostDisplayName}` : channelTitle;
    const broadcastTitle = settings.broadcastTitle || fallbackTitle;
    const broadcastDescription = settings.broadcastDescription || "Live from Bouncecore.";
    const broadcast = await createPublicBroadcast(accessToken, broadcastTitle, broadcastDescription);

    if (!broadcast.id) {
      throw new Error("YouTube created a broadcast without returning its ID.");
    }

    runtime = runtimeForSession(sessionId, {
      broadcastId: broadcast.id,
      lastAttemptAt: new Date().toISOString(),
      status: "creating",
      streamId: stream.id,
      updatedAt: new Date().toISOString()
    });
    await updateYouTubeRestreamRuntime(slot, runtime);
    await bindBroadcast(accessToken, broadcast.id, stream.id);

    runtime = runtimeForSession(sessionId, {
      ...runtime,
      status: "bound",
      updatedAt: new Date().toISOString()
    });
    await updateYouTubeRestreamRuntime(slot, runtime);

    await writeAuditLog({
      action: "stream.youtube_broadcast.create",
      actorId: null,
      metadata: {
        broadcastId: broadcast.id,
        channelId: connection.channelId,
        privacyStatus: "public",
        sessionId,
        slot,
        streamId: stream.id
      },
      severity: "info",
      target: `stream-session:${sessionId}`
    });

    return {
      broadcastId: broadcast.id,
      channelTitle: connection.channelTitle,
      detail: "Public YouTube broadcast created and bound; waiting for YouTube ingest.",
      slot,
      status: "bound"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube automatic public broadcast failed.";
    const previousError = runtime.lastError;
    const failedRuntime = runtimeForSession(sessionId, {
      ...runtime,
      lastAttemptAt: new Date().toISOString(),
      lastError: message,
      status: "error",
      updatedAt: new Date().toISOString()
    });

    await updateYouTubeRestreamRuntime(slot, failedRuntime).catch(() => undefined);

    if (previousError !== message) {
      await writeAuditLog({
        action: "stream.youtube_broadcast.publish_failed",
        actorId: null,
        metadata: {
          error: message,
          sessionId,
          slot
        },
        severity: "warning",
        target: `stream-session:${sessionId}`
      });
    }

    return {
      broadcastId: failedRuntime.broadcastId,
      channelTitle: connection.channelTitle,
      detail: message,
      slot,
      status: "error"
    };
  }
}

export async function syncPublicYouTubeRestreams(input: {
  channelTitle: string;
  hostDisplayName: string | null;
  sessionId: string;
}): Promise<YouTubeRestreamSyncResult[]> {
  const settled = await Promise.allSettled(restreamTargetSlots.map((slot) => syncYouTubeSlot({ ...input, slot })));

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      broadcastId: null,
      channelTitle: null,
      detail: result.reason instanceof Error ? result.reason.message : "YouTube restream synchronization failed.",
      slot: restreamTargetSlots[index],
      status: "error"
    };
  });
}
