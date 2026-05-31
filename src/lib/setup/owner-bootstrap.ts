import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { seedRbac } from "@/lib/auth/rbac-seed";
import { hashPassword } from "@/lib/auth/passwords";
import { makeProfileSlug } from "@/lib/auth/slugs";
import { createSecretToken, hashSecretToken, tokenFingerprint } from "@/lib/auth/tokens";
import { sessionMaxAgeSeconds } from "@/lib/auth/auth-service";

export type OwnerSetupStatus = {
  databaseAvailable: boolean;
  ownerExists: boolean;
  userCount: number | null;
  message?: string;
};

export type OwnerSetupInput = {
  displayName: string;
  email: string;
  password: string;
};

export type OwnerSetupResult =
  | { ok: true; token: string; redirectTo: string }
  | { ok: false; error: string; redirectTo: string };

class OwnerAlreadyExistsError extends Error {}

function sessionExpiry() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000);
}

async function requestContext() {
  const headerStore = await headers();

  return {
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip"),
    userAgent: headerStore.get("user-agent")
  };
}

export async function getOwnerSetupStatus(): Promise<OwnerSetupStatus> {
  try {
    const [userCount, ownerRole] = await Promise.all([
      prisma.user.count(),
      prisma.role.findUnique({
        where: { name: "owner" },
        include: {
          _count: {
            select: {
              users: true
            }
          }
        }
      })
    ]);

    return {
      databaseAvailable: true,
      ownerExists: Boolean(ownerRole?._count.users),
      userCount
    };
  } catch {
    return {
      databaseAvailable: false,
      ownerExists: false,
      userCount: null,
      message: "The Bouncecore database is not reachable yet."
    };
  }
}

export async function bootstrapOwner(input: OwnerSetupInput): Promise<OwnerSetupResult> {
  const context = await requestContext();
  const passwordHash = await hashPassword(input.password);
  const token = createSecretToken("bc_session");
  const tokenHash = hashSecretToken(token);

  try {
    await prisma.$transaction(async (tx) => {
      await seedRbac(tx);

      const ownerRole = await tx.role.findUniqueOrThrow({ where: { name: "owner" } });
      const ownerCount = await tx.userRole.count({ where: { roleId: ownerRole.id } });

      if (ownerCount > 0) {
        throw new OwnerAlreadyExistsError("Owner account already exists.");
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          status: "active",
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              slug: makeProfileSlug(input.displayName)
            }
          }
        }
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
          assignedById: user.id
        }
      });

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
          action: "setup.owner_bootstrap",
          target: `user:${user.id}`,
          severity: "critical",
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
    if (error instanceof OwnerAlreadyExistsError) {
      return { ok: false, error: "owner-exists", redirectTo: "/setup/owner?error=owner-exists" };
    }

    throw error;
  }
}
