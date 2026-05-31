import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";
import { createSecretToken, hashSecretToken, tokenFingerprint } from "@/lib/auth/tokens";

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

function createRawStreamKey() {
  return createSecretToken("bc_live");
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

export async function createOwnStreamKey(userId: string, actorId: string): Promise<StreamKeyMutationResult> {
  const existingKey = await getOwnActiveStreamKey(userId);

  if (existingKey) {
    return {
      key: existingKey
    };
  }

  const rawKey = createRawStreamKey();
  const keyHash = hashSecretToken(rawKey);
  const fingerprint = tokenFingerprint(rawKey);

  const key = await prisma.streamKey.create({
    data: {
      userId,
      keyHash,
      fingerprint,
      status: activeStatus
    }
  });

  await writeAuditLog({
    actorId,
    action: "stream.key.create",
    target: `stream-key:${key.id}`,
    severity: "critical",
    metadata: {
      fingerprint
    }
  });

  return {
    key: toSummary(key),
    rawKey
  };
}

export async function rotateOwnStreamKey(userId: string, actorId: string): Promise<StreamKeyMutationResult> {
  const now = new Date();
  const rawKey = createRawStreamKey();
  const keyHash = hashSecretToken(rawKey);
  const fingerprint = tokenFingerprint(rawKey);

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
        keyHash,
        fingerprint,
        status: activeStatus
      }
    });
  });

  await writeAuditLog({
    actorId,
    action: "stream.key.rotate",
    target: `stream-key:${key.id}`,
    severity: "critical",
    metadata: {
      fingerprint
    }
  });

  return {
    key: toSummary(key),
    rawKey
  };
}

export async function revokeOwnStreamKey(userId: string, actorId: string): Promise<StreamKeyMutationResult> {
  const activeKey = await getOwnActiveStreamKey(userId);

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
