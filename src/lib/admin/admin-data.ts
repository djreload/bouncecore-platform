import { prisma } from "@/lib/db/prisma";

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
  return prisma.role.findMany({
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
  });
}

export async function getAdminPermissions() {
  return prisma.permission.findMany({
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
