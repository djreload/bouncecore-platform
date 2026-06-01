import { addAdminUserRole, removeAdminUserRole } from "@/lib/auth/user-admin-service";
import { prisma } from "@/lib/db/prisma";

export async function getAdminSupportersData() {
  const [supporters, candidates] = await Promise.all([
    prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: "supporter"
            }
          }
        }
      },
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
      include: {
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
            orders: true
          }
        }
      },
      take: 100
    }),
    prisma.user.findMany({
      where: {
        status: {
          in: ["active", "pending"]
        },
        roles: {
          none: {
            role: {
              name: "supporter"
            }
          }
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
        }
      },
      take: 100
    })
  ]);
  const supporterIds = supporters.map((supporter) => supporter.id);
  const [wallets, orderTotals] = supporterIds.length
    ? await Promise.all([
        prisma.starWallet.findMany({
          where: {
            userId: {
              in: supporterIds
            }
          }
        }),
        prisma.order.groupBy({
          by: ["userId"],
          where: {
            userId: {
              in: supporterIds
            }
          },
          _sum: {
            totalPence: true
          }
        })
      ])
    : [[], []];
  const walletByUserId = new Map(wallets.map((wallet) => [wallet.userId, wallet]));
  const orderTotalByUserId = new Map(orderTotals.map((orderTotal) => [orderTotal.userId, orderTotal._sum.totalPence ?? 0]));
  const activeSupporters = supporters.filter((supporter) => supporter.status === "active").length;
  const totalStars = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const totalSpendPence = Array.from(orderTotalByUserId.values()).reduce((sum, value) => sum + value, 0);

  return {
    stats: {
      supporters: supporters.length,
      activeSupporters,
      totalStars,
      totalSpendPence
    },
    supporters: supporters.map((supporter) => ({
      id: supporter.id,
      displayName: supporter.displayName,
      email: supporter.email,
      status: supporter.status,
      lastLoginAt: supporter.lastLoginAt,
      createdAt: supporter.createdAt,
      roles: supporter.roles.map((userRole) => userRole.role.name),
      orders: supporter._count.orders,
      stars: walletByUserId.get(supporter.id)?.balance ?? 0,
      spendPence: orderTotalByUserId.get(supporter.id) ?? 0
    })),
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      displayName: candidate.displayName,
      email: candidate.email,
      status: candidate.status,
      roles: candidate.roles.map((userRole) => userRole.role.name)
    }))
  };
}

export async function grantSupporterRole(userId: string, actorId: string) {
  await addAdminUserRole(userId, "supporter", actorId);
  await prisma.starWallet.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      userId,
      balance: 0
    }
  });
}

export async function removeSupporterRole(userId: string, actorId: string) {
  await removeAdminUserRole(userId, "supporter", actorId);
}
