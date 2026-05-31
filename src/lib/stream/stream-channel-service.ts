import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";
import { getStreamProvider, type StreamHealth, type StreamStatus } from "@/lib/stream/stream-provider";
import { streamStatusOptions, type ChannelStatus } from "@/lib/stream/stream-status";

export type StreamChannelInput = {
  channelId?: string;
  title: string;
  slug: string;
  status: ChannelStatus;
  playbackUrl?: string;
};

export type StreamChannelSummary = {
  id: string;
  slug: string;
  title: string;
  status: string;
  playbackUrl: string | null;
  streamKeys: number;
  sessions: number;
  events: number;
};

export type StreamProviderSnapshot = {
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
  } | null;
  provider: StreamProviderSnapshot;
  status: string;
  playbackUrl: string | null;
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
    streamKeys: channel._count.streamKeys,
    sessions: channel._count.sessions,
    events: channel._count.events
  };
}

export async function getProviderSnapshot(): Promise<StreamProviderSnapshot> {
  const provider = getStreamProvider();
  const [status, playbackUrl, viewerCount, health] = await Promise.all([
    provider.getStreamStatus(),
    provider.getPlaybackUrl(),
    provider.getViewerCount(),
    provider.getStreamHealth()
  ]);

  return {
    status,
    playbackUrl,
    viewerCount,
    health
  };
}

export async function getAdminStreamControlData() {
  const [channels, provider] = await Promise.all([
    prisma.streamChannel.findMany({
      orderBy: {
        slug: "asc"
      },
      include: {
        _count: {
          select: {
            streamKeys: true,
            sessions: true,
            events: true
          }
        }
      }
    }),
    getProviderSnapshot()
  ]);

  return {
    channels: channels.map(toSummary),
    provider
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

  return {
    sessions,
    events
  };
}

export async function ensureDefaultStreamChannel(actorId: string) {
  const playbackUrl = process.env.PUBLIC_PLAYBACK_URL ?? null;
  const { channel, adoptedKeys } = await prisma.$transaction(async (tx) => {
    const channel = await tx.streamChannel.upsert({
      where: {
        slug: "main"
      },
      update: {
        playbackUrl: playbackUrl ?? undefined
      },
      create: {
        slug: "main",
        title: "Bouncecore Live",
        status: "offline",
        playbackUrl
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

  const channel = await prisma.streamChannel.create({
    data: {
      slug: normalizeSlug(input.slug),
      title: input.title.trim(),
      status: input.status,
      playbackUrl: input.playbackUrl?.trim() || null
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
        playbackUrl: input.playbackUrl?.trim() || null
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
  const provider = await getProviderSnapshot();

  try {
    const channel = await prisma.streamChannel.findFirst({
      orderBy: {
        slug: "asc"
      }
    });

    return {
      channel: channel
        ? {
            slug: channel.slug,
            title: channel.title,
            status: channel.status,
            playbackUrl: channel.playbackUrl
          }
        : null,
      provider,
      status: channel?.status ?? provider.status,
      playbackUrl: channel?.playbackUrl ?? provider.playbackUrl,
      viewerCount: provider.viewerCount,
      health: provider.health
    };
  } catch {
    return {
      channel: null,
      provider,
      status: provider.status,
      playbackUrl: provider.playbackUrl,
      viewerCount: provider.viewerCount,
      health: provider.health
    };
  }
}
