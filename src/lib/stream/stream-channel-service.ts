import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeOptionalStreamOfflineImageUrl } from "@/lib/media/media-service";
import { getStreamProvider, type StreamHealth, type StreamPlaybackSource, type StreamStatus } from "@/lib/stream/stream-provider";
import {
  ensureDefaultStreamProfiles,
  getDefaultStreamProfile,
  getStreamProfiles,
  streamProfileToSummary,
  type StreamProfileSummary
} from "@/lib/stream/stream-profile-service";
import { getAdminRestreamSettings } from "@/lib/stream/restream-settings-service";
import { streamStatusOptions, type ChannelStatus } from "@/lib/stream/stream-status";
import { getLiveViewerPresenceCount } from "@/lib/presence/live-viewer-presence";

export type StreamChannelInput = {
  channelId?: string;
  title: string;
  slug: string;
  status: ChannelStatus;
  playbackUrl?: string;
  offlineImageUrl?: string;
  streamProfileId?: string;
};

export type StreamChannelSummary = {
  id: string;
  slug: string;
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  streamProfile: StreamProfileSummary | null;
  streamKeys: number;
  sessions: number;
  events: number;
};

export type StreamProviderSnapshot = {
  activeIngests: StreamPlaybackSource[];
  status: StreamStatus;
  playbackUrl: string | null;
  viewerCount: number;
  health: StreamHealth;
};

export type PublicLiveState = {
  channel: {
    slug: string;
    title: string;
    status: string;
    playbackUrl: string | null;
    offlineImageUrl: string | null;
    streamProfile: StreamProfileSummary | null;
  } | null;
  activeIngests: StreamPlaybackSource[];
  provider: StreamProviderSnapshot;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  viewerCount: number;
  health: StreamHealth;
};

function normalizeSlug(slug: string) {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "main";
}

function assertStatus(status: string): asserts status is ChannelStatus {
  if (!streamStatusOptions.includes(status as ChannelStatus)) {
    throw new Error("Invalid stream channel status.");
  }
}

function toSummary(channel: {
  id: string;
  slug: string;
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  streamProfile: StreamProfileSummary | null;
  _count: {
    streamKeys: number;
    sessions: number;
    events: number;
  };
}): StreamChannelSummary {
  return {
    id: channel.id,
    slug: channel.slug,
    title: channel.title,
    status: channel.status,
    playbackUrl: channel.playbackUrl,
    offlineImageUrl: channel.offlineImageUrl,
    streamProfile: streamProfileToSummary(channel.streamProfile),
    streamKeys: channel._count.streamKeys,
    sessions: channel._count.sessions,
    events: channel._count.events
  };
}

async function assertStreamProfileId(profileId?: string) {
  if (!profileId) {
    return (await getDefaultStreamProfile())?.id ?? null;
  }

  const profile = await prisma.streamProfile.findFirst({
    where: {
      id: profileId,
      isEnabled: true
    },
    select: {
      id: true
    }
  });

  if (!profile) {
    throw new Error("Invalid stream profile.");
  }

  return profile.id;
}

export async function getProviderSnapshot(): Promise<StreamProviderSnapshot> {
  const provider = getStreamProvider();
  const [activeIngests, status, playbackUrl, viewerCount, health] = await Promise.all([
    provider.getActiveIngests(),
    provider.getStreamStatus(),
    provider.getPlaybackUrl(),
    provider.getViewerCount(),
    provider.getStreamHealth()
  ]);

  return {
    activeIngests,
    status,
    playbackUrl,
    viewerCount,
    health
  };
}

export async function getAdminStreamControlData() {
  await ensureDefaultStreamProfiles();

  const [channels, provider, restreamSettings, streamProfiles] = await Promise.all([
    prisma.streamChannel.findMany({
      orderBy: {
        slug: "asc"
      },
      include: {
        streamProfile: true,
        _count: {
          select: {
            streamKeys: true,
            sessions: true,
            events: true
          }
        }
      }
    }),
    getProviderSnapshot(),
    getAdminRestreamSettings(),
    getStreamProfiles({
      includeDisabled: true
    })
  ]);

  return {
    channels: channels.map(toSummary),
    provider,
    restreamSettings,
    streamProfiles
  };
}

export async function getAdminStreamSessionsData() {
  const [sessions, events] = await Promise.all([
    prisma.streamSession.findMany({
      orderBy: {
        startedAt: "desc"
      },
      include: {
        channel: true
      },
      take: 50
    }),
    prisma.streamEvent.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        channel: true
      },
      take: 50
    })
  ]);
  const starsBySession = sessions.length
    ? await prisma.starSend.groupBy({
        by: ["streamSessionId"],
        where: {
          streamSessionId: {
            in: sessions.map((session) => session.id)
          }
        },
        _count: {
          _all: true
        },
        _sum: {
          amount: true
        }
      })
    : [];
  const starsBySessionId = new Map(
    starsBySession
      .filter((row) => row.streamSessionId)
      .map((row) => [
        row.streamSessionId as string,
        {
          sendCount: row._count._all,
          stars: row._sum.amount ?? 0
        }
      ])
  );

  return {
    sessions: sessions.map((session) => ({
      ...session,
      starSendCount: starsBySessionId.get(session.id)?.sendCount ?? 0,
      starsSent: starsBySessionId.get(session.id)?.stars ?? 0
    })),
    events
  };
}

export async function ensureDefaultStreamChannel(actorId: string) {
  await ensureDefaultStreamProfiles();
  const streamProfile = await getDefaultStreamProfile();
  const playbackUrl = process.env.PUBLIC_PLAYBACK_URL ?? null;
  const { channel, adoptedKeys } = await prisma.$transaction(async (tx) => {
    const channel = await tx.streamChannel.upsert({
      where: {
        slug: "main"
      },
      update: {
        playbackUrl: playbackUrl ?? undefined,
        streamProfileId: streamProfile?.id ?? undefined
      },
      create: {
        slug: "main",
        title: "Bouncecore Live",
        status: "offline",
        playbackUrl,
        streamProfileId: streamProfile?.id ?? null
      }
    });
    const adoptedKeys = await tx.streamKey.updateMany({
      where: {
        channelId: null
      },
      data: {
        channelId: channel.id
      }
    });

    return {
      channel,
      adoptedKeys: adoptedKeys.count
    };
  });

  await writeAuditLog({
    actorId,
    action: "stream.channel.ensure_default",
    target: `stream-channel:${channel.id}`,
    severity: "info",
    metadata: {
      slug: channel.slug,
      adoptedKeys
    }
  });

  return channel;
}

export async function createStreamChannel(input: StreamChannelInput, actorId: string) {
  assertStatus(input.status);
  const streamProfileId = await assertStreamProfileId(input.streamProfileId);

  const channel = await prisma.streamChannel.create({
    data: {
      slug: normalizeSlug(input.slug),
      title: input.title.trim(),
      status: input.status,
      playbackUrl: input.playbackUrl?.trim() || null,
      offlineImageUrl: normalizeOptionalStreamOfflineImageUrl(input.offlineImageUrl),
      streamProfileId
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.channel.create",
    target: `stream-channel:${channel.id}`,
    severity: "info",
    metadata: {
      slug: channel.slug,
      status: channel.status
    }
  });

  return channel;
}

export async function updateStreamChannel(input: StreamChannelInput, actorId: string) {
  if (!input.channelId) {
    throw new Error("Missing stream channel.");
  }

  assertStatus(input.status);
  const streamProfileId = await assertStreamProfileId(input.streamProfileId);

  const existing = await prisma.streamChannel.findUniqueOrThrow({
    where: {
      id: input.channelId
    }
  });
  const statusChanged = existing.status !== input.status;

  const channel = await prisma.$transaction(async (tx) => {
    const updated = await tx.streamChannel.update({
      where: {
        id: input.channelId
      },
      data: {
        slug: normalizeSlug(input.slug),
        title: input.title.trim(),
        status: input.status,
        playbackUrl: input.playbackUrl?.trim() || null,
        offlineImageUrl: normalizeOptionalStreamOfflineImageUrl(input.offlineImageUrl),
        streamProfileId
      }
    });

    if (statusChanged) {
      const eventType =
        input.status === "live" ? "stream.started" : input.status === "offline" ? "stream.stopped" : "stream.status.updated";

      await tx.streamEvent.create({
        data: {
          channelId: updated.id,
          type: eventType,
          payload: {
            from: existing.status,
            to: input.status
          }
        }
      });
    }

    return updated;
  });

  await writeAuditLog({
    actorId,
    action: "stream.channel.update",
    target: `stream-channel:${channel.id}`,
    severity: statusChanged ? "warning" : "info",
    metadata: {
      slug: channel.slug,
      status: channel.status,
      previousStatus: existing.status
    }
  });

  return channel;
}

export async function getPublicLiveState(): Promise<PublicLiveState> {
  const [provider, defaultProfile, liveViewerCount] = await Promise.all([
    getProviderSnapshot(),
    getDefaultStreamProfile(),
    getLiveViewerPresenceCount()
  ]);

  try {
    const channel = await prisma.streamChannel.findFirst({
      orderBy: {
        slug: "asc"
      },
      include: {
        streamProfile: true
      }
    });
    const status = provider.status !== "offline" ? provider.status : channel?.status ?? provider.status;
    const viewerCount = status === "offline" ? 0 : Math.max(provider.viewerCount, liveViewerCount);

    return {
      activeIngests: provider.activeIngests,
      channel: channel
        ? {
            slug: channel.slug,
            title: channel.title,
            status: channel.status,
            playbackUrl: channel.playbackUrl,
            offlineImageUrl: channel.offlineImageUrl,
            streamProfile: streamProfileToSummary(channel.streamProfile) ?? defaultProfile
          }
        : null,
      provider,
      status,
      playbackUrl: channel?.playbackUrl ?? provider.playbackUrl,
      offlineImageUrl: channel?.offlineImageUrl ?? null,
      viewerCount,
      health: provider.health
    };
  } catch {
    const viewerCount = provider.status === "offline" ? 0 : Math.max(provider.viewerCount, liveViewerCount);

    return {
      activeIngests: provider.activeIngests,
      channel: null,
      provider,
      status: provider.status,
      playbackUrl: provider.playbackUrl,
      offlineImageUrl: null,
      viewerCount,
      health: provider.health
    };
  }
}
