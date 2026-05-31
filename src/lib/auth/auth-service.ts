import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { Prisma, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/auth/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { createSecretToken, hashSecretToken, tokenFingerprint } from "@/lib/auth/tokens";

export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export type AuthResult =
  | { ok: true; token: string; redirectTo: string }
  | { ok: false; error: string; redirectTo: string };

type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

async function requestContext() {
  const headerStore = await headers();

  return {
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip"),
    userAgent: headerStore.get("user-agent")
  };
}

function sessionExpiry() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000);
}

function allowedLoginStatus(status: UserStatus) {
  return status === "active" || status === "pending";
}

function makeProfileSlug(displayName: string) {
  const base = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "raver"}-${randomBytes(3).toString("hex")}`;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const context = await requestContext();
  const passwordHash = await hashPassword(input.password);
  const token = createSecretToken("bc_session");
  const tokenHash = hashSecretToken(token);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          status: "pending",
          profile: {
            create: {
              slug: makeProfileSlug(input.displayName)
            }
          }
        }
      });

      const viewerRole = await tx.role.findUnique({ where: { name: "viewer" } });

      if (viewerRole) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: viewerRole.id
          }
        });
      }

      await tx.authSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: sessionExpiry(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "auth.register",
          target: `user:${user.id}`,
          severity: "info",
          metadata: {
            sessionFingerprint: tokenFingerprint(token)
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      });
    });

    return { ok: true, token, redirectTo: "/account/security" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "email-in-use", redirectTo: "/auth/register?error=email-in-use" };
    }

    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const context = await requestContext();
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    return { ok: false, error: "invalid-credentials", redirectTo: "/auth/login?error=invalid-credentials" };
  }

  if (!allowedLoginStatus(user.status)) {
    await writeAuditLog({
      actorId: user.id,
      action: "auth.login_blocked",
      target: `user:${user.id}`,
      severity: "warning",
      metadata: { status: user.status },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return { ok: false, error: "account-disabled", redirectTo: "/auth/login?error=account-disabled" };
  }

  const token = createSecretToken("bc_session");

  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSecretToken(token),
      expiresAt: sessionExpiry(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  await writeAuditLog({
    actorId: user.id,
    action: "auth.login",
    target: `user:${user.id}`,
    metadata: {
      sessionFingerprint: tokenFingerprint(token)
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  });

  return { ok: true, token, redirectTo: "/account/security" };
}

export async function revokeSessionByHash(tokenHash: string | null) {
  if (!tokenHash) {
    return;
  }

  await prisma.authSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}
