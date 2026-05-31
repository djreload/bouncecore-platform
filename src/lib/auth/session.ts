import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/auth/rbac";
import { hashSecretToken } from "@/lib/auth/tokens";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import { prisma } from "@/lib/db/prisma";

export const sessionCookieName = "bouncecore_session";

export async function getSessionTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  return token ? hashSecretToken(token) : null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const tokenHash = await getSessionTokenHash();

  if (!tokenHash) {
    return null;
  }

  try {
    const session = await prisma.authSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true
              }
            }
          }
        }
      }
    });

    if (!session || session.user.status === "banned" || session.user.status === "suspended") {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      roles: normalizeRoles(session.user.roles.map((userRole) => userRole.role.name))
    };
  } catch {
    return null;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}
