import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";

export type AccountSession = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

export async function getActiveAccountSessions(userId: string, currentTokenHash: string | null) {
  const sessions = await prisma.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return sessions.map<AccountSession>((session) => ({
    id: session.id,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isCurrent: Boolean(currentTokenHash && session.tokenHash === currentTokenHash)
  }));
}

export async function revokeAccountSession(sessionId: string, userId: string, currentTokenHash: string | null) {
  if (!sessionId) {
    throw new Error("Missing session.");
  }

  const session = await prisma.authSession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (!session) {
    return;
  }

  if (currentTokenHash && session.tokenHash === currentTokenHash) {
    throw new Error("Use sign out to revoke the current browser session.");
  }

  await prisma.authSession.update({
    where: {
      id: session.id
    },
    data: {
      revokedAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "auth.session.revoke",
    target: `auth_session:${session.id}`,
    severity: "warning",
    metadata: {
      scope: "single",
      ipAddress: session.ipAddress,
      userAgent: session.userAgent
    }
  });
}

export async function revokeOtherAccountSessions(userId: string, currentTokenHash: string | null) {
  if (!currentTokenHash) {
    throw new Error("Missing current session.");
  }

  const result = await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      tokenHash: {
        not: currentTokenHash
      },
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      revokedAt: new Date()
    }
  });

  if (result.count > 0) {
    await writeAuditLog({
      actorId: userId,
      action: "auth.session.revoke_others",
      target: `user:${userId}`,
      severity: "warning",
      metadata: {
        scope: "others",
        revokedSessions: result.count
      }
    });
  }

  return result.count;
}
