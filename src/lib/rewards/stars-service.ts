import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

export type StarWalletRow = {
  userId: string;
  displayName: string;
  email: string;
  status: string;
  roles: string[];
  balance: number;
  updatedAt: string;
  hasWallet: boolean;
};

export type PublicRewardsData = {
  stats: {
    wallets: number;
    totalStars: number;
    topBalance: number;
    supporters: number;
  };
  leaderboard: StarWalletRow[];
};

export type AccountRewardsData = {
  wallet: {
    balance: number;
    updatedAt: Date;
  };
  rank: number | null;
  supporter: boolean;
  orderStats: {
    orders: number;
    spendPence: number;
  };
};

export type AdminStarsData = PublicRewardsData & {
  users: StarWalletRow[];
};

function parseInteger(value: string, label: string, min: number, max: number) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }

  return number;
}

export function parseStarBalance(value: string) {
  return parseInteger(value, "Star balance", 0, 999999999);
}

export function parseStarAdjustment(value: string) {
  return parseInteger(value, "Star adjustment", -999999, 999999);
}

async function rowsForUsers(userIds: string[], balances: Map<string, { balance: number; updatedAt: Date }>): Promise<StarWalletRow[]> {
  if (!userIds.length) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds
      }
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
    }
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return userIds.flatMap((userId) => {
    const user = userById.get(userId);

    if (!user) {
      return [];
    }

    const wallet = balances.get(user.id);

    return [
      {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        roles: user.roles.map((userRole) => userRole.role.name),
        balance: wallet?.balance ?? 0,
        updatedAt: (wallet?.updatedAt ?? user.updatedAt).toISOString(),
        hasWallet: Boolean(wallet)
      }
    ];
  });
}

async function getStarStats(): Promise<PublicRewardsData["stats"]> {
  const [wallets, aggregate, topWallet, supporters] = await Promise.all([
    prisma.starWallet.count(),
    prisma.starWallet.aggregate({
      _sum: {
        balance: true
      }
    }),
    prisma.starWallet.findFirst({
      orderBy: {
        balance: "desc"
      },
      select: {
        balance: true
      }
    }),
    prisma.user.count({
      where: {
        roles: {
          some: {
            role: {
              name: "supporter"
            }
          }
        }
      }
    })
  ]);

  return {
    supporters,
    topBalance: topWallet?.balance ?? 0,
    totalStars: aggregate._sum.balance ?? 0,
    wallets
  };
}

export async function getPublicRewardsData(): Promise<PublicRewardsData> {
  const [stats, wallets] = await Promise.all([
    getStarStats(),
    prisma.starWallet.findMany({
      orderBy: [{ balance: "desc" }, { updatedAt: "desc" }],
      take: 20
    })
  ]);
  const balanceByUserId = new Map(wallets.map((wallet) => [wallet.userId, { balance: wallet.balance, updatedAt: wallet.updatedAt }]));
  const leaderboard = await rowsForUsers(
    wallets.map((wallet) => wallet.userId),
    balanceByUserId
  );

  return {
    leaderboard,
    stats
  };
}

export async function getAccountRewardsData(userId: string): Promise<AccountRewardsData> {
  const wallet = await prisma.starWallet.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      balance: 0,
      userId
    }
  });
  const [higherBalances, user, orderAggregate, orderCount] = await Promise.all([
    wallet.balance > 0
      ? prisma.starWallet.count({
          where: {
            balance: {
              gt: wallet.balance
            }
          }
        })
      : Promise.resolve(null),
    prisma.user.findUniqueOrThrow({
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
    }),
    prisma.order.aggregate({
      where: {
        userId
      },
      _sum: {
        totalPence: true
      }
    }),
    prisma.order.count({
      where: {
        userId
      }
    })
  ]);

  return {
    orderStats: {
      orders: orderCount,
      spendPence: orderAggregate._sum.totalPence ?? 0
    },
    rank: higherBalances === null ? null : higherBalances + 1,
    supporter: user.roles.some((userRole) => userRole.role.name === "supporter"),
    wallet: {
      balance: wallet.balance,
      updatedAt: wallet.updatedAt
    }
  };
}

export async function getAdminStarsData(): Promise<AdminStarsData> {
  const [publicData, wallets, users] = await Promise.all([
    getPublicRewardsData(),
    prisma.starWallet.findMany(),
    prisma.user.findMany({
      where: {
        status: {
          in: ["active", "pending"]
        }
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
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
      take: 150
    })
  ]);
  const balanceByUserId = new Map(wallets.map((wallet) => [wallet.userId, { balance: wallet.balance, updatedAt: wallet.updatedAt }]));

  return {
    ...publicData,
    users: users.map((user) => {
      const wallet = balanceByUserId.get(user.id);

      return {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
        roles: user.roles.map((userRole) => userRole.role.name),
        balance: wallet?.balance ?? 0,
        updatedAt: (wallet?.updatedAt ?? user.updatedAt).toISOString(),
        hasWallet: Boolean(wallet)
      };
    })
  };
}

export async function ensureStarWallet(userId: string, actorId: string) {
  const wallet = await prisma.starWallet.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      balance: 0,
      userId
    }
  });

  await writeAuditLog({
    actorId,
    action: "stars.wallet.ensure",
    target: `star-wallet:${wallet.id}`,
    severity: "info",
    metadata: {
      balance: wallet.balance,
      userId
    }
  });

  return wallet;
}

export async function setStarBalance(userId: string, actorId: string, balance: number) {
  const wallet = await prisma.starWallet.upsert({
    where: {
      userId
    },
    update: {
      balance
    },
    create: {
      balance,
      userId
    }
  });

  await writeAuditLog({
    actorId,
    action: "stars.wallet.set",
    target: `star-wallet:${wallet.id}`,
    severity: "warning",
    metadata: {
      balance: wallet.balance,
      userId
    }
  });

  return wallet;
}

export async function adjustStarBalance(userId: string, actorId: string, delta: number) {
  const existing = await prisma.starWallet.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      balance: 0,
      userId
    }
  });
  const nextBalance = Math.max(0, existing.balance + delta);
  const wallet = await prisma.starWallet.update({
    where: {
      userId
    },
    data: {
      balance: nextBalance
    }
  });

  await writeAuditLog({
    actorId,
    action: "stars.wallet.adjust",
    target: `star-wallet:${wallet.id}`,
    severity: "warning",
    metadata: {
      delta,
      nextBalance: wallet.balance,
      previousBalance: existing.balance,
      userId
    }
  });

  return wallet;
}
