import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";
import { createSecretToken, hashSecretToken, tokenFingerprint } from "@/lib/auth/tokens";
import {
  getDefaultStreamProfile,
  streamProfileToSummary,
  type StreamProfileSummary
} from "@/lib/stream/stream-profile-service";

const activeStatus = "active";

export type StreamKeySummary = {
  id: string;
  fingerprint: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type StreamKeyMutationResult = {
  key: StreamKeySummary | null;
  rawKey?: string;
};

export type StreamKeyValidationResult =
  | {
      channel: {
        id: string;
        playbackUrl: string | null;
        slug: string;
        streamProfile: StreamProfileSummary | null;
        title: string;
      } | null;
      key: {
        fingerprint: string;
        id: string;
        lastUsedAt: string | null;
      };
      profile: StreamProfileSummary | null;
      user: {
        displayName: string;
        email: string;
        id: string;
      };
      valid: true;
    }
  | {
      reason: "missing_key" | "invalid_key";
      valid: false;
    };

type StreamKeyAuditOptions = {
  action: string;
  actorId: string;
  metadata?: Record<string, string>;
};

function createRawStreamKey() {
  return createSecretToken("bc_live");
}

async function getPrimaryChannelId() {
  const channel = await prisma.streamChannel.findFirst({
    orderBy: {
      slug: "asc"
    },
    select: {
      id: true
    }
  });

  return channel?.id;
}

function toSummary(key: {
  id: string;
  fingerprint: string;
  status: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}): StreamKeySummary {
  return {
    id: key.id,
    fingerprint: key.fingerprint,
    status: key.status,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null
  };
}

export async function getOwnActiveStreamKey(userId: string): Promise<StreamKeySummary | null> {
  return getActiveStreamKeyForUser(userId);
}

export async function getActiveStreamKeyForUser(userId: string): Promise<StreamKeySummary | null> {
  const key = await prisma.streamKey.findFirst({
    where: {
      userId,
      status: activeStatus,
      revokedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return key ? toSummary(key) : null;
}

export async function validateRawStreamKey(
  rawKey: string,
  options: { markUsed?: boolean } = {}
): Promise<StreamKeyValidationResult> {
  const normalizedKey = rawKey.trim();

  if (!normalizedKey) {
    return {
      reason: "missing_key",
      valid: false
    };
  }

  const key = await prisma.streamKey.findFirst({
    where: {
      keyHash: hashSecretToken(normalizedKey),
      status: activeStatus,
      revokedAt: null
    },
    include: {
      channel: {
        include: {
          streamProfile: true
        }
      },
      user: {
        select: {
          displayName: true,
          email: true,
          id: true
        }
      }
    }
  });

  if (!key) {
    return {
      reason: "invalid_key",
      valid: false
    };
  }

  const now = new Date();
  const [channel, defaultProfile] = await Promise.all([
    key.channel ??
      prisma.streamChannel.findFirst({
        orderBy: {
          slug: "asc"
        },
        include: {
          streamProfile: true
        }
      }),
    getDefaultStreamProfile()
  ]);

  const shouldMarkUsed = options.markUsed ?? true;

  if (shouldMarkUsed) {
    await prisma.streamKey.update({
      where: {
        id: key.id
      },
      data: {
        lastUsedAt: now
      }
    });
  }

  const streamProfile = streamProfileToSummary(channel?.streamProfile) ?? defaultProfile;

  return {
    channel: channel
      ? {
          id: channel.id,
          playbackUrl: channel.playbackUrl,
          slug: channel.slug,
          streamProfile,
          title: channel.title
        }
      : null,
    key: {
      fingerprint: key.fingerprint,
      id: key.id,
      lastUsedAt: shouldMarkUsed ? now.toISOString() : key.lastUsedAt?.toISOString() ?? null
    },
    profile: streamProfile,
    user: key.user,
    valid: true
  };
}

export async function createOwnStreamKey(userId: string, actorId: string): Promise<StreamKeyMutationResult> {
  return createStreamKeyForUser(userId, {
    action: "stream.key.create",
    actorId
  });
}

export async function createStreamKeyForUser(
  userId: string,
  audit: StreamKeyAuditOptions
): Promise<StreamKeyMutationResult> {
  const existingKey = await getActiveStreamKeyForUser(userId);

  if (existingKey) {
    return {
      key: existingKey
    };
  }

  const rawKey = createRawStreamKey();
  const keyHash = hashSecretToken(rawKey);
  const fingerprint = tokenFingerprint(rawKey);
  const channelId = await getPrimaryChannelId();

  const key = await prisma.streamKey.create({
    data: {
      userId,
      channelId,
      keyHash,
      fingerprint,
      status: activeStatus
    }
  });

  await writeAuditLog({
    actorId: audit.actorId,
    action: audit.action,
    target: `stream-key:${key.id}`,
    severity: "critical",
    metadata: {
      fingerprint,
      targetUserId: userId,
      ...audit.metadata
    }
  });

  return {
    key: toSummary(key),
    rawKey
  };
}

export async function rotateOwnStreamKey(userId: string, actorId: string): Promise<StreamKeyMutationResult> {
  return rotateStreamKeyForUser(userId, {
    action: "stream.key.rotate",
    actorId
  });
}

export async function rotateStreamKeyForUser(
  userId: string,
  audit: StreamKeyAuditOptions
): Promise<StreamKeyMutationResult> {
  const now = new Date();
  const rawKey = createRawStreamKey();
  const keyHash = hashSecretToken(rawKey);
  const fingerprint = tokenFingerprint(rawKey);
  const channelId = await getPrimaryChannelId();

  const key = await prisma.$transaction(async (tx) => {
    await tx.streamKey.updateMany({
      where: {
        userId,
        status: activeStatus,
        revokedAt: null
      },
      data: {
        status: "rotated",
        revokedAt: now
      }
    });

    return tx.streamKey.create({
      data: {
        userId,
        channelId,
        keyHash,
        fingerprint,
        status: activeStatus
      }
    });
  });

  await writeAuditLog({
    actorId: audit.actorId,
    action: audit.action,
    target: `stream-key:${key.id}`,
    severity: "critical",
    metadata: {
      fingerprint,
      targetUserId: userId,
      ...audit.metadata
    }
  });

  return {
    key: toSummary(key),
    rawKey
  };
}

export async function revokeOwnStreamKey(userId: string, actorId: string): Promise<StreamKeyMutationResult> {
  const activeKey = await getActiveStreamKeyForUser(userId);

  if (!activeKey) {
    return {
      key: null
    };
  }

  await prisma.streamKey.update({
    where: {
      id: activeKey.id
    },
    data: {
      status: "revoked",
      revokedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.key.revoke",
    target: `stream-key:${activeKey.id}`,
    severity: "critical",
    metadata: {
      fingerprint: activeKey.fingerprint
    }
  });

  return {
    key: null
  };
}

export async function revokeStreamKeyById(
  keyId: string,
  audit: StreamKeyAuditOptions
): Promise<StreamKeyMutationResult> {
  const key = await prisma.streamKey.findUnique({
    where: {
      id: keyId
    }
  });

  if (!key || key.revokedAt) {
    return {
      key: null
    };
  }

  await prisma.streamKey.update({
    where: {
      id: key.id
    },
    data: {
      status: "revoked",
      revokedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: audit.actorId,
    action: audit.action,
    target: `stream-key:${key.id}`,
    severity: "critical",
    metadata: {
      fingerprint: key.fingerprint,
      targetUserId: key.userId,
      ...audit.metadata
    }
  });

  return {
    key: null
  };
}
