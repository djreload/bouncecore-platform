import { prisma } from "@/lib/db/prisma";
import { rolePermissions, type Permission, type Role } from "@/lib/auth/rbac";

const systemRoleKeys = new Set<string>(Object.keys(rolePermissions));

function isSystemRoleKey(value: string): value is Role {
  return systemRoleKeys.has(value);
}

function effectivePermissionKeysForRole(roleName: string) {
  if (!isSystemRoleKey(roleName)) {
    return null;
  }

  return rolePermissions[roleName] as readonly Permission[];
}

function sortRolePermissionRows<T extends { permission: { key: string } }>(rows: T[]) {
  return rows.sort((left, right) => left.permission.key.localeCompare(right.permission.key));
}

function sortPermissionRoleRows<T extends { role: { name: string } }>(rows: T[]) {
  return rows.sort((left, right) => left.role.name.localeCompare(right.role.name));
}

export async function getAdminDashboardData() {
  const [users, roles, permissions, activeSessions, streamKeys, chatrooms, tracks, products, orders, auditLogs] =
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.authSession.count({
        where: {
          revokedAt: null,
          expiresAt: {
            gt: new Date()
          }
        }
      }),
      prisma.streamKey.count(),
      prisma.chatRoom.count(),
      prisma.digitalTrack.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.auditLog.count()
    ]);

  return {
    users,
    roles,
    permissions,
    activeSessions,
    streamKeys,
    chatrooms,
    tracks,
    products,
    orders,
    auditLogs
  };
}

export async function getAdminUsers() {
  return prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      profile: true,
      roles: {
        include: {
          role: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      _count: {
        select: {
          authSessions: true,
          orders: true,
          streamKeys: true
        }
      }
    },
    take: 100
  });
}

export async function getAdminRoles() {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: {
        name: "asc"
      },
      include: {
        permissions: {
          include: {
            permission: true
          },
          orderBy: {
            permission: {
              key: "asc"
            }
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    }),
    prisma.permission.findMany()
  ]);
  const permissionsByKey = new Map(permissions.map((permission) => [permission.key, permission]));

  return roles.map((role) => {
    const effectivePermissionKeys = effectivePermissionKeysForRole(role.name);

    if (!effectivePermissionKeys) {
      return role;
    }

    const existingRowsByKey = new Map(role.permissions.map((row) => [row.permission.key, row]));
    const effectivePermissions = effectivePermissionKeys.flatMap((permissionKey) => {
      const existingRow = existingRowsByKey.get(permissionKey);

      if (existingRow) {
        return [existingRow];
      }

      const permission = permissionsByKey.get(permissionKey);

      if (!permission) {
        return [];
      }

      return [
        {
          permission,
          permissionId: permission.id,
          roleId: role.id
        }
      ];
    });

    return {
      ...role,
      permissions: sortRolePermissionRows(effectivePermissions)
    };
  });
}

export async function getAdminPermissions() {
  const [permissions, roles] = await Promise.all([
    prisma.permission.findMany({
      orderBy: [{ group: "asc" }, { key: "asc" }],
      include: {
        roles: {
          include: {
            role: true
          },
          orderBy: {
            role: {
              name: "asc"
            }
          }
        }
      }
    }),
    prisma.role.findMany({
      orderBy: {
        name: "asc"
      }
    })
  ]);

  return permissions.map((permission) => {
    const existingRowsByRoleName = new Map(permission.roles.map((row) => [row.role.name, row]));
    const effectiveRows = [...permission.roles];

    for (const role of roles) {
      const effectivePermissionKeys = effectivePermissionKeysForRole(role.name);

      if (!effectivePermissionKeys?.includes(permission.key as Permission) || existingRowsByRoleName.has(role.name)) {
        continue;
      }

      effectiveRows.push({
        permissionId: permission.id,
        role,
        roleId: role.id
      });
    }

    return {
      ...permission,
      roles: sortPermissionRoleRows(effectiveRows)
    };
  });
}

export async function getAdminAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      actor: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    take: 50
  });
}

export async function getAdminStreamKeys() {
  return prisma.streamKey.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: true
            },
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }
    },
    take: 100
  });
}

export async function getAdminStreamKeyUsers() {
  return prisma.user.findMany({
    where: {
      status: {
        in: ["active", "pending"]
      }
    },
    orderBy: {
      displayName: "asc"
    },
    include: {
      roles: {
        include: {
          role: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      streamKeys: {
        where: {
          status: "active",
          revokedAt: null
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    },
    take: 100
  });
}
