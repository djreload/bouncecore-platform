import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  queueStreamLiveNotifications,
  type MobileEventNotificationQueueResult
} from "@/lib/mobile/event-notification-service";
import { getDefaultStreamProfile } from "@/lib/stream/stream-profile-service";
import { getProviderSnapshot, type StreamProviderSnapshot } from "@/lib/stream/stream-channel-service";
import {
  syncPublicYouTubeRestreams,
  type YouTubeRestreamSyncResult
} from "@/lib/stream/youtube-restream-service";
import {
  finishFacebookRestreams,
  syncFacebookRestreams,
  type FacebookRestreamSyncResult
} from "@/lib/stream/facebook-restream-service";

type StreamSyncPayload = {
  bitrateKbps: number | null;
  checkedAt: string;
  droppedFrames: number | null;
  healthStatus: string;
  ingestConnected: boolean;
  playbackUrl: string | null;
  providerStatus: string;
  viewerCount: number;
};

export type StreamSessionSyncResult = {
  channelId: string;
  eventTypes: string[];
  facebookRestreams: FacebookRestreamSyncResult[];
  ingestConnected: boolean;
  liveNotification: MobileEventNotificationQueueResult | { error: string } | null;
  openSessionId: string | null;
  playbackUrl: string | null;
  providerStatus: string;
  sessionsClosed: number;
  sessionStarted: boolean;
  status: string;
  viewerCount: number;
  youtubeRestreams: YouTubeRestreamSyncResult[];
};

function providerIsActive(snapshot: StreamProviderSnapshot) {
  return snapshot.health.ingestConnected || snapshot.status === "live" || snapshot.status === "starting" || snapshot.status === "degraded";
}

function channelStatusFromSnapshot(snapshot: StreamProviderSnapshot) {
  if (!providerIsActive(snapshot)) {
    return "offline";
  }

  return snapshot.status === "offline" ? "live" : snapshot.status;
}

function syncPayload(snapshot: StreamProviderSnapshot): StreamSyncPayload {
  return {
    bitrateKbps: snapshot.health.bitrateKbps ?? null,
    checkedAt: snapshot.health.checkedAt,
    droppedFrames: snapshot.health.droppedFrames ?? null,
    healthStatus: snapshot.health.status,
    ingestConnected: snapshot.health.ingestConnected,
    playbackUrl: snapshot.playbackUrl,
    providerStatus: snapshot.status,
    viewerCount: snapshot.viewerCount
  };
}

async function getLiveNotificationHostDisplayName(snapshot: StreamProviderSnapshot) {
  const primaryIngest = snapshot.activeIngests.find((ingest) => ingest.role === "primary") ?? snapshot.activeIngests[0];
  const presenterName = primaryIngest?.presenterName?.trim();

  if (presenterName) {
    return presenterName;
  }

  if (!primaryIngest?.streamKeyFingerprint) {
    return null;
  }

  const streamKey = await prisma.streamKey.findUnique({
    where: {
      fingerprint: primaryIngest.streamKeyFingerprint
    },
    select: {
      user: {
        select: {
          displayName: true
        }
      }
    }
  });

  return streamKey?.user.displayName ?? null;
}

async function ensurePrimaryChannel() {
  const existing = await prisma.streamChannel.findFirst({
    orderBy: {
      slug: "asc"
    }
  });

  if (existing) {
    return existing;
  }

  const streamProfile = await getDefaultStreamProfile();

  return prisma.streamChannel.create({
    data: {
      playbackUrl: process.env.PUBLIC_PLAYBACK_URL ?? null,
      slug: "main",
      status: "offline",
      streamProfileId: streamProfile?.id ?? null,
      title: "Bouncecore Live"
    }
  });
}

export async function syncStreamProviderSnapshot(snapshot?: StreamProviderSnapshot): Promise<StreamSessionSyncResult> {
  snapshot ??= await getProviderSnapshot();

  const channel = await ensurePrimaryChannel();
  const active = providerIsActive(snapshot);
  const targetStatus = channelStatusFromSnapshot(snapshot);
  const payload = syncPayload(snapshot);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "StreamChannel" WHERE id = ${channel.id} FOR UPDATE`;

    const openSession = await tx.streamSession.findFirst({
      orderBy: {
        startedAt: "desc"
      },
      where: {
        channelId: channel.id,
        endedAt: null
      }
    });
    const eventTypes: string[] = [];
    let sessionStarted = false;
    let openSessionId = openSession?.id ?? null;
    let sessionsClosed = 0;

    if (active) {
      if (openSession) {
        await tx.streamSession.update({
          data: {
            peakViewers: Math.max(openSession.peakViewers, snapshot.viewerCount)
          },
          where: {
            id: openSession.id
          }
        });
      } else {
        const session = await tx.streamSession.create({
          data: {
            channelId: channel.id,
            peakViewers: snapshot.viewerCount,
            startedAt: now
          }
        });

        openSessionId = session.id;
        sessionStarted = true;
        eventTypes.push("stream.provider.connected");
      }
    } else if (openSession) {
      const result = await tx.streamSession.updateMany({
        data: {
          endedAt: now
        },
        where: {
          channelId: channel.id,
          endedAt: null
        }
      });

      sessionsClosed = result.count;
      eventTypes.push("stream.provider.disconnected");
      openSessionId = null;
    }

    if (channel.status !== targetStatus && !eventTypes.includes("stream.provider.connected") && !eventTypes.includes("stream.provider.disconnected")) {
      eventTypes.push("stream.provider.status");
    }

    await tx.streamChannel.update({
      data: {
        playbackUrl: snapshot.playbackUrl ?? channel.playbackUrl,
        status: targetStatus
      },
      where: {
        id: channel.id
      }
    });

    for (const type of eventTypes) {
      await tx.streamEvent.create({
        data: {
          channelId: channel.id,
          payload: {
            ...payload,
            from: channel.status,
            openSessionId,
            sessionsClosed,
            to: targetStatus
          },
          type
        }
      });
    }

    return {
      channelId: channel.id,
      eventTypes,
      ingestConnected: active,
      liveNotification: null,
      openSessionId,
      playbackUrl: snapshot.playbackUrl ?? channel.playbackUrl,
      providerStatus: snapshot.status,
      sessionsClosed,
      sessionStarted,
      status: targetStatus,
      viewerCount: snapshot.viewerCount
    };
  });

  let hostDisplayName: string | null = null;
  let facebookRestreams: FacebookRestreamSyncResult[] = [];
  let youtubeRestreams: YouTubeRestreamSyncResult[] = [];

  if (result.ingestConnected && result.openSessionId) {
    try {
      hostDisplayName = await getLiveNotificationHostDisplayName(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Live presenter lookup failed.";

      await writeAuditLog({
        action: "stream.presenter_lookup.failed",
        actorId: null,
        metadata: {
          error: message,
          sessionId: result.openSessionId
        },
        severity: "warning",
        target: `stream-session:${result.openSessionId}`
      });
    }

    const [youtubeResult, facebookResult] = await Promise.allSettled([
      syncPublicYouTubeRestreams({
        channelTitle: channel.title,
        hostDisplayName,
        sessionId: result.openSessionId
      }),
      syncFacebookRestreams({
        channelTitle: channel.title,
        hostDisplayName,
        sessionId: result.openSessionId
      })
    ]);

    if (youtubeResult.status === "fulfilled") {
      youtubeRestreams = youtubeResult.value;
    } else {
      const message = youtubeResult.reason instanceof Error
        ? youtubeResult.reason.message
        : "YouTube restream synchronization failed.";

      await writeAuditLog({
        action: "stream.youtube_broadcast.sync_failed",
        actorId: null,
        metadata: {
          error: message,
          sessionId: result.openSessionId
        },
        severity: "warning",
        target: `stream-session:${result.openSessionId}`
      });
    }

    if (facebookResult.status === "fulfilled") {
      facebookRestreams = facebookResult.value;
    } else {
      const message = facebookResult.reason instanceof Error
        ? facebookResult.reason.message
        : "Facebook restream synchronization failed.";

      await writeAuditLog({
        action: "stream.facebook_live.sync_failed",
        actorId: null,
        metadata: {
          error: message,
          sessionId: result.openSessionId
        },
        severity: "warning",
        target: `stream-session:${result.openSessionId}`
      });
    }
  } else {
    facebookRestreams = await finishFacebookRestreams();
  }

  const syncedResult = {
    ...result,
    facebookRestreams,
    youtubeRestreams
  };

  if (!result.sessionStarted || !result.openSessionId) {
    return syncedResult;
  }

  try {
    return {
      ...syncedResult,
      liveNotification: await queueStreamLiveNotifications({
        channelId: result.channelId,
        channelTitle: channel.title,
        hostDisplayName,
        sessionId: result.openSessionId
      })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream live notification queue failed.";

    await writeAuditLog({
      action: "mobile.push.stream_live.queue_failed",
      actorId: null,
      metadata: {
        channelId: result.channelId,
        error: message,
        sessionId: result.openSessionId
      },
      severity: "warning",
      target: `stream-session:${result.openSessionId}`
    });

    return {
      ...syncedResult,
      liveNotification: {
        error: message
      }
    };
  }
}
