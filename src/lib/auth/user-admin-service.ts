import type { UserStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { roleDefinitions, type Role } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export const userStatusOptions = ["active", "pending", "suspended", "banned"] as const satisfies readonly UserStatus[];

const roleKeys = new Set<string>(roleDefinitions.map((role) => role.key));

function assertUserStatus(status: string): asserts status is UserStatus {
  if (!userStatusOptions.includes(status as UserStatus)) {
    throw new Error("Unknown user status.");
  }
}

function assertRoleKey(role: string): asserts role is Role {
  if (!roleKeys.has(role)) {
    throw new Error("Unknown role.");
  }
}

async function activeOwnerCountExcluding(userId: string) {
  return prisma.userRole.count({
    where: {
      userId: {
        not: userId
      },
      role: {
        name: "owner"
      },
      user: {
        status: {
          in: ["active", "pending"]
        }
      }
    }
  });
}

async function totalOwnerAssignments() {
  return prisma.userRole.count({
    where: {
      role: {
        name: "owner"
      }
    }
  });
}

export async function updateAdminUserStatus(userId: string, status: string, actorId: string) {
  assertUserStatus(status);

  if (!userId) {
    throw new Error("Missing user.");
  }

  if (userId === actorId && (status === "suspended" || status === "banned")) {
    throw new Error("You cannot suspend or ban your own account.");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  const isOwner = user.roles.some((userRole) => userRole.role.name === "owner");

  if (isOwner && (status === "suspended" || status === "banned") && (await activeOwnerCountExcluding(userId)) < 1) {
    throw new Error("You cannot disable the last active server owner.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: userId
      },
      data: {
        status
      }
    });

    if (status === "suspended" || status === "banned") {
      await tx.authSession.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }
  });

  await writeAuditLog({
    actorId,
    action: "user.status.update",
    target: `user:${userId}`,
    severity: status === "suspended" || status === "banned" ? "warning" : "info",
    metadata: {
      previousStatus: user.status,
      status
    }
  });
}

export async function addAdminUserRole(userId: string, role: string, actorId: string) {
  assertRoleKey(role);

  if (!userId) {
    throw new Error("Missing user.");
  }

  const dbRole = await prisma.role.findUniqueOrThrow({
    where: {
      name: role
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: dbRole.id
      }
    },
    update: {
      assignedById: actorId
    },
    create: {
      userId,
      roleId: dbRole.id,
      assignedById: actorId
    }
  });

  await writeAuditLog({
    actorId,
    action: "user.role.add",
    target: `user:${userId}`,
    severity: role === "owner" ? "critical" : "info",
    metadata: {
      role
    }
  });
}

export async function removeAdminUserRole(userId: string, role: string, actorId: string) {
  assertRoleKey(role);

  if (!userId) {
    throw new Error("Missing user.");
  }

  if (role === "owner" && (await totalOwnerAssignments()) <= 1) {
    throw new Error("You cannot remove the last server owner role.");
  }

  const dbRole = await prisma.role.findUniqueOrThrow({
    where: {
      name: role
    }
  });

  await prisma.userRole.deleteMany({
    where: {
      userId,
      roleId: dbRole.id
    }
  });

  await writeAuditLog({
    actorId,
    action: "user.role.remove",
    target: `user:${userId}`,
    severity: role === "owner" ? "critical" : "warning",
    metadata: {
      role
    }
  });
}
