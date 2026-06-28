import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import {
  getRewardWheelCooldownState,
  getRewardWheelSpinCostState,
  getRewardWheelTotalWeight,
  pickWeightedRewardSegment,
  rewardWheelResultStatus
} from "@/lib/rewards/reward-wheel-core";

export const rewardWheelStatuses = ["draft", "active", "paused", "archived"] as const;
export const rewardSegmentStatuses = ["active", "disabled"] as const;
export const rewardPrizeTypes = ["none", "merch", "music", "vip", "manual"] as const;
export const prizeClaimStatuses = ["pending", "approved", "fulfilled", "rejected"] as const;

export type RewardWheelStatus = (typeof rewardWheelStatuses)[number];
export type RewardSegmentStatus = (typeof rewardSegmentStatuses)[number];
export type RewardPrizeType = (typeof rewardPrizeTypes)[number];
export type PrizeClaimStatus = (typeof prizeClaimStatuses)[number];

export type RewardWheelInput = {
  cooldownMinutes: string;
  costStars: string;
  description?: string;
  name: string;
  slug: string;
  status: string;
  wheelId?: string;
};

export type RewardSegmentInput = {
  label: string;
  prizeType: string;
  prizeValue?: string;
  segmentId?: string;
  sortOrder: string;
  starAmount: string;
  status: string;
  weight: string;
  wheelId: string;
};

export type RewardSegmentMoveInput = {
  direction: "down" | "up";
  segmentId: string;
  wheelId: string;
};

export type RewardWheelSegmentSpreadInput = {
  wheelId: string;
};

export type RewardWheelDeleteInput = {
  wheelId: string;
};

export type RewardSegmentDeleteInput = {
  segmentId: string;
  wheelId: string;
};

export type PrizeClaimInput = {
  description?: string;
  prizeType: string;
  prizeValue?: string;
  segmentId?: string;
  starAmount: string;
  title: string;
  userId: string;
  wheelId?: string;
};

export type PrizeClaimStatusInput = {
  claimId: string;
  fulfilmentNote?: string;
  status: string;
};

export type AdminSpinWheelsData = {
  claimsPending: number;
  shopProducts: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    variants: Array<{
      id: string;
      name: string;
      pricePence: number;
      sku: string;
      stock: number;
    }>;
  }>;
  stats: {
    activeSegments: number;
    activeWheels: number;
    segments: number;
    wheels: number;
  };
  wheels: Array<{
    cooldownMinutes: number;
    costStars: number;
    createdAt: string;
    description: string | null;
    id: string;
    name: string;
    segments: Array<{
      claimCount: number;
      id: string;
      label: string;
      prizeType: string;
      prizeValue: string | null;
      sortOrder: number;
      starAmount: number;
      status: string;
      weight: number;
    }>;
    slug: string;
    status: string;
    totalWeight: number;
  }>;
};

export type AdminPrizeClaimsData = {
  claims: Array<{
    createdAt: string;
    description: string | null;
    fulfilmentNote: string | null;
    id: string;
    prizeType: string;
    prizeValue: string | null;
    resolvedAt: string | null;
    resolvedByDisplayName: string | null;
    segmentLabel: string | null;
    starAmount: number;
    starsCreditedAt: string | null;
    status: string;
    title: string;
    userDisplayName: string;
    userEmail: string;
    wheelName: string | null;
    wheelSlug: string | null;
  }>;
  segments: Array<{
    id: string;
    label: string;
    prizeType: string;
    starAmount: number;
    wheelId: string;
    wheelName: string;
  }>;
  stats: {
    approved: number;
    fulfilled: number;
    pending: number;
    rejected: number;
    starLiability: number;
    total: number;
  };
  users: Array<{
    displayName: string;
    email: string;
    id: string;
    roles: Role[];
    status: string;
  }>;
  wheels: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

export type AccountRewardWheelsData = {
  recentClaims: AccountPrizeClaimRow[];
  walletBalance: number;
  wheels: AccountRewardWheelRow[];
};

export type AccountRewardWheelRow = {
  canSpin: boolean;
  cooldownMinutes: number;
  cooldownRemainingSeconds: number;
  cooldownRetryAt: string | null;
  costStars: number;
  description: string | null;
  id: string;
  name: string;
  segments: Array<{
    id: string;
    label: string;
    oddsPercent: number;
    prizeType: string;
    starAmount: number;
    weight: number;
  }>;
  slug: string;
  totalWeight: number;
  unavailableReason: string | null;
};

export type AccountPrizeClaimRow = {
  createdAt: string;
  description: string | null;
  id: string;
  prizeType: string;
  segmentLabel: string | null;
  starAmount: number;
  status: string;
  title: string;
  wheelName: string | null;
};

export type RewardWheelSpinResult = {
  claimId: string;
  message: string;
  prizeType: string;
  segmentId: string;
  segmentLabel: string;
  status: string;
  walletBalance: number;
  wheelId: string;
  wheelName: string;
};

export class RewardWheelSpinError extends Error {
  constructor(
    message: string,
    public readonly code: "cooldown" | "insufficient-stars" | "invalid-wheel" | "no-segments"
  ) {
    super(message);
  }
}

function normalizedText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function normalizedRequiredText(value: string | undefined, maxLength: number, label: string) {
  const text = normalizedText(value, maxLength);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function parseInteger(value: string, label: string, min: number, max: number) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }

  return number;
}

function parseOptionalInteger(value: string | undefined, label: string, min: number, max: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  return parseInteger(text, label, min, max);
}

function normalizeSlug(value: string, fallback: string) {
  const slug = (value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  if (slug.length < 3) {
    throw new Error("Wheel slug must be at least 3 characters.");
  }

  return slug;
}

function assertWheelStatus(value: string): asserts value is RewardWheelStatus {
  if (!rewardWheelStatuses.includes(value as RewardWheelStatus)) {
    throw new Error("Choose a valid wheel status.");
  }
}

function assertSegmentStatus(value: string): asserts value is RewardSegmentStatus {
  if (!rewardSegmentStatuses.includes(value as RewardSegmentStatus)) {
    throw new Error("Choose a valid segment status.");
  }
}

function assertPrizeType(value: string): asserts value is RewardPrizeType {
  if (!rewardPrizeTypes.includes(value as RewardPrizeType)) {
    throw new Error("Choose a valid prize type.");
  }
}

function assertClaimStatus(value: string): asserts value is PrizeClaimStatus {
  if (!prizeClaimStatuses.includes(value as PrizeClaimStatus)) {
    throw new Error("Choose a valid claim status.");
  }
}

function normalizeRoleList(values: string[]) {
  return normalizeRoles(values);
}

function statusStats<T extends string>(items: Array<{ status: string }>, keys: readonly T[]) {
  return items.reduce<Record<T | "total", number>>(
    (stats, item) => {
      if (keys.includes(item.status as T)) {
        stats[item.status as T] += 1;
      }

      stats.total += 1;
      return stats;
    },
    keys.reduce<Record<T | "total", number>>(
      (stats, key) => ({
        ...stats,
        [key]: 0
      }),
      { total: 0 } as Record<T | "total", number>
    )
  );
}

export async function getAdminSpinWheelsData(): Promise<AdminSpinWheelsData> {
  const [wheels, claimsPending, shopProducts] = await Promise.all([
    prisma.rewardSpinWheel.findMany({
      include: {
        segments: {
          include: {
            _count: {
              select: {
                prizeClaims: true
              }
            }
          },
          orderBy: [
            {
              sortOrder: "asc"
            },
            {
              createdAt: "asc"
            },
            {
              id: "asc"
            }
          ]
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.prizeClaim.count({
      where: {
        status: {
          in: ["pending", "approved"]
        }
      }
    }),
    prisma.product.findMany({
      where: {
        status: {
          not: "archived"
        }
      },
      include: {
        variants: {
          orderBy: [
            {
              name: "asc"
            },
            {
              sku: "asc"
            }
          ]
        }
      },
      orderBy: [
        {
          name: "asc"
        },
        {
          slug: "asc"
        }
      ]
    })
  ]);
  const segments = wheels.flatMap((wheel) => wheel.segments);

  return {
    claimsPending,
    shopProducts: shopProducts.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        pricePence: variant.pricePence,
        sku: variant.sku,
        stock: variant.stock
      }))
    })),
    stats: {
      activeSegments: segments.filter((segment) => segment.status === "active").length,
      activeWheels: wheels.filter((wheel) => wheel.status === "active").length,
      segments: segments.length,
      wheels: wheels.length
    },
    wheels: wheels.map((wheel) => ({
      cooldownMinutes: wheel.cooldownMinutes,
      costStars: wheel.costStars,
      createdAt: wheel.createdAt.toISOString(),
      description: wheel.description,
      id: wheel.id,
      name: wheel.name,
      segments: wheel.segments.map((segment) => ({
        claimCount: segment._count.prizeClaims,
        id: segment.id,
        label: segment.label,
        prizeType: segment.prizeType,
        prizeValue: segment.prizeValue,
        sortOrder: segment.sortOrder,
        starAmount: segment.starAmount,
        status: segment.status,
        weight: segment.weight
      })),
      slug: wheel.slug,
      status: wheel.status,
      totalWeight: getRewardWheelTotalWeight(wheel.segments)
    }))
  };
}

export async function createOrUpdateRewardWheel(input: RewardWheelInput, actorId: string) {
  const status = input.status.trim();
  assertWheelStatus(status);

  const name = normalizedRequiredText(input.name, 120, "Wheel name");
  const slug = normalizeSlug(input.slug, name);
  const data = {
    cooldownMinutes: parseInteger(input.cooldownMinutes, "Cooldown", 0, 60 * 24 * 30),
    costStars: parseInteger(input.costStars, "Cost", 0, 1000000),
    description: normalizedText(input.description, 600),
    name,
    slug,
    status
  };
  const wheel = input.wheelId
    ? await prisma.rewardSpinWheel.update({
        where: {
          id: input.wheelId
        },
        data
      })
    : await prisma.rewardSpinWheel.create({
        data
      });

  await writeAuditLog({
    actorId,
    action: input.wheelId ? "rewards.wheel.update" : "rewards.wheel.create",
    target: `reward-wheel:${wheel.id}`,
    severity: status === "active" ? "warning" : "info",
    metadata: {
      costStars: wheel.costStars,
      slug: wheel.slug,
      status: wheel.status
    }
  });

  return wheel;
}

export async function deleteRewardWheel(input: RewardWheelDeleteInput, actorId: string) {
  if (!input.wheelId) {
    throw new Error("Missing reward wheel.");
  }

  const wheel = await prisma.rewardSpinWheel.findUniqueOrThrow({
    where: {
      id: input.wheelId
    },
    include: {
      _count: {
        select: {
          prizeClaims: true,
          segments: true
        }
      }
    }
  });

  await prisma.rewardSpinWheel.delete({
    where: {
      id: wheel.id
    }
  });

  await writeAuditLog({
    actorId,
    action: "rewards.wheel.delete",
    target: `reward-wheel:${wheel.id}`,
    severity: "warning",
    metadata: {
      claimCount: wheel._count.prizeClaims,
      segmentCount: wheel._count.segments,
      slug: wheel.slug,
      status: wheel.status
    }
  });

  return wheel;
}

export async function ensureDefaultRewardWheel(actorId: string) {
  const wheel = await prisma.rewardSpinWheel.upsert({
    where: {
      slug: "supporter-wheel"
    },
    update: {
      name: "Supporter Wheel",
      status: "draft"
    },
    create: {
      cooldownMinutes: 1440,
      costStars: 0,
      description: "Starter supporter rewards wheel. Spin to reveal a saved prize result.",
      name: "Supporter Wheel",
      slug: "supporter-wheel",
      status: "draft",
      segments: {
        create: [
          {
            label: "Sticker pack",
            prizeType: "merch",
            prizeValue: "sticker-pack",
            sortOrder: 10,
            starAmount: 0,
            weight: 25
          },
          {
            label: "VIP shoutout",
            prizeType: "vip",
            prizeValue: "shoutout",
            sortOrder: 20,
            weight: 10
          },
          {
            label: "Try again",
            prizeType: "none",
            sortOrder: 30,
            weight: 65
          }
        ]
      }
    }
  });

  await writeAuditLog({
    actorId,
    action: "rewards.wheel.ensure_default",
    target: `reward-wheel:${wheel.id}`,
    severity: "info",
    metadata: {
      slug: wheel.slug
    }
  });

  return wheel;
}

export async function createOrUpdateRewardSegment(input: RewardSegmentInput, actorId: string) {
  const status = input.status.trim();
  const prizeType = input.prizeType.trim();
  assertSegmentStatus(status);
  assertPrizeType(prizeType);

  const starAmount = parseInteger(input.starAmount, "Prize quantity", 0, 1000000);
  const submittedSortOrder = parseOptionalInteger(input.sortOrder, "Wheel order", 0, 100000);
  let sortOrder = submittedSortOrder;

  if (sortOrder === null) {
    sortOrder = input.segmentId
      ? (await prisma.rewardSpinWheelSegment.findUnique({
          select: {
            sortOrder: true
          },
          where: {
            id: input.segmentId
          }
        }))?.sortOrder ?? 0
      : ((await prisma.rewardSpinWheelSegment.aggregate({
          _max: {
            sortOrder: true
          },
          where: {
            wheelId: input.wheelId
          }
        }))._max.sortOrder ?? -10) + 10;
  }

  const data = {
    label: normalizedRequiredText(input.label, 120, "Segment label"),
    prizeType,
    prizeValue: normalizedText(input.prizeValue, 240),
    sortOrder,
    starAmount,
    status,
    weight: parseInteger(input.weight, "Weight", 1, 100000)
  };
  const segment = input.segmentId
    ? await prisma.rewardSpinWheelSegment.update({
        where: {
          id: input.segmentId
        },
        data
      })
    : await prisma.rewardSpinWheelSegment.create({
        data: {
          ...data,
          wheelId: input.wheelId
        }
      });

  await writeAuditLog({
    actorId,
    action: input.segmentId ? "rewards.wheel_segment.update" : "rewards.wheel_segment.create",
    target: `reward-wheel-segment:${segment.id}`,
    severity: "info",
    metadata: {
      prizeType: segment.prizeType,
      status: segment.status,
      wheelId: segment.wheelId
    }
  });

  return segment;
}

export async function deleteRewardSegment(input: RewardSegmentDeleteInput, actorId: string) {
  if (!input.segmentId || !input.wheelId) {
    throw new Error("Missing reward wheel segment.");
  }

  const segment = await prisma.rewardSpinWheelSegment.findFirstOrThrow({
    where: {
      id: input.segmentId,
      wheelId: input.wheelId
    },
    include: {
      _count: {
        select: {
          prizeClaims: true
        }
      }
    }
  });

  await prisma.rewardSpinWheelSegment.delete({
    where: {
      id: segment.id
    }
  });

  await writeAuditLog({
    actorId,
    action: "rewards.wheel_segment.delete",
    target: `reward-wheel-segment:${segment.id}`,
    severity: "warning",
    metadata: {
      claimCount: segment._count.prizeClaims,
      label: segment.label,
      prizeType: segment.prizeType,
      wheelId: segment.wheelId
    }
  });

  return segment;
}

export async function moveRewardSegment(input: RewardSegmentMoveInput, actorId: string) {
  const segments = await prisma.rewardSpinWheelSegment.findMany({
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      },
      {
        id: "asc"
      }
    ],
    where: {
      wheelId: input.wheelId
    }
  });
  const currentIndex = segments.findIndex((segment) => segment.id === input.segmentId);
  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0) {
    throw new Error("Reward wheel segment was not found.");
  }

  const segment = segments[currentIndex];
  const neighbour = segments[targetIndex];

  if (!neighbour) {
    return segment;
  }

  const reorderedSegments = [...segments];
  reorderedSegments[currentIndex] = neighbour;
  reorderedSegments[targetIndex] = segment;

  await prisma.$transaction(
    reorderedSegments.map((orderedSegment, index) =>
      prisma.rewardSpinWheelSegment.update({
        data: {
          sortOrder: index * 10
        },
        where: {
          id: orderedSegment.id
        }
      })
    )
  );

  await writeAuditLog({
    actorId,
    action: "rewards.wheel_segment.move",
    target: `reward-wheel-segment:${segment.id}`,
    severity: "info",
    metadata: {
      direction: input.direction,
      wheelId: segment.wheelId
    }
  });

  return segment;
}

function rewardSegmentSpreadKey(segment: { label: string; prizeType: string }) {
  return `${segment.prizeType}:${segment.label.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export async function spreadRewardWheelSegments(input: RewardWheelSegmentSpreadInput, actorId: string) {
  const segments = await prisma.rewardSpinWheelSegment.findMany({
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      },
      {
        id: "asc"
      }
    ],
    where: {
      wheelId: input.wheelId
    }
  });

  if (segments.length <= 2) {
    return segments;
  }

  const buckets = new Map<string, typeof segments>();

  for (const segment of segments) {
    const key = rewardSegmentSpreadKey(segment);
    buckets.set(key, [...(buckets.get(key) ?? []), segment]);
  }

  const reorderedSegments: typeof segments = [];
  let lastKey = "";

  while (reorderedSegments.length < segments.length) {
    const candidates = [...buckets.entries()]
      .filter(([, bucket]) => bucket.length > 0)
      .sort((left, right) => {
        const keyPenaltyLeft = left[0] === lastKey ? 1 : 0;
        const keyPenaltyRight = right[0] === lastKey ? 1 : 0;

        if (keyPenaltyLeft !== keyPenaltyRight) {
          return keyPenaltyLeft - keyPenaltyRight;
        }

        return right[1].length - left[1].length || (left[1][0]?.sortOrder ?? 0) - (right[1][0]?.sortOrder ?? 0);
      });
    const selected = candidates[0];

    if (!selected) {
      break;
    }

    const [key, bucket] = selected;
    const nextSegment = bucket.shift();

    if (nextSegment) {
      reorderedSegments.push(nextSegment);
      lastKey = key;
    }
  }

  await prisma.$transaction(
    reorderedSegments.map((segment, index) =>
      prisma.rewardSpinWheelSegment.update({
        data: {
          sortOrder: index * 10
        },
        where: {
          id: segment.id
        }
      })
    )
  );

  await writeAuditLog({
    actorId,
    action: "rewards.wheel_segment.spread",
    target: `reward-wheel:${input.wheelId}`,
    severity: "info",
    metadata: {
      segmentCount: reorderedSegments.length
    }
  });

  return reorderedSegments;
}

export async function getAdminPrizeClaimsData(): Promise<AdminPrizeClaimsData> {
  const [claims, users, wheels, segments] = await Promise.all([
    prisma.prizeClaim.findMany({
      include: {
        resolvedBy: {
          select: {
            displayName: true
          }
        },
        segment: true,
        user: true,
        wheel: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    }),
    prisma.user.findMany({
      where: {
        status: {
          in: ["active", "pending"]
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
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      take: 200
    }),
    prisma.rewardSpinWheel.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    }),
    prisma.rewardSpinWheelSegment.findMany({
      include: {
        wheel: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        label: "asc"
      }
    })
  ]);
  const stats = statusStats(claims, prizeClaimStatuses);

  return {
    claims: claims.map((claim) => ({
      createdAt: claim.createdAt.toISOString(),
      description: claim.description,
      fulfilmentNote: claim.fulfilmentNote,
      id: claim.id,
      prizeType: claim.prizeType,
      prizeValue: claim.prizeValue,
      resolvedAt: claim.resolvedAt?.toISOString() ?? null,
      resolvedByDisplayName: claim.resolvedBy?.displayName ?? null,
      segmentLabel: claim.segment?.label ?? null,
      starAmount: claim.starAmount,
      starsCreditedAt: claim.starsCreditedAt?.toISOString() ?? null,
      status: claim.status,
      title: claim.title,
      userDisplayName: claim.user.displayName,
      userEmail: claim.user.email,
      wheelName: claim.wheel?.name ?? null,
      wheelSlug: claim.wheel?.slug ?? null
    })),
    segments: segments.map((segment) => ({
      id: segment.id,
      label: segment.label,
      prizeType: segment.prizeType,
      starAmount: segment.starAmount,
      wheelId: segment.wheelId,
      wheelName: segment.wheel.name
    })),
    stats: {
      approved: stats.approved,
      fulfilled: stats.fulfilled,
      pending: stats.pending,
      rejected: stats.rejected,
      starLiability: claims
        .filter((claim) => claim.status !== "fulfilled" && claim.status !== "rejected")
        .reduce((total, claim) => total + claim.starAmount, 0),
      total: stats.total
    },
    users: users.map((user) => ({
      displayName: user.displayName,
      email: user.email,
      id: user.id,
      roles: normalizeRoleList(user.roles.map((userRole) => userRole.role.name)),
      status: user.status
    })),
    wheels
  };
}

export async function getAccountRewardWheelsData(userId: string): Promise<AccountRewardWheelsData> {
  const [wallet, wheels, claims] = await Promise.all([
    prisma.starWallet.upsert({
      where: {
        userId
      },
      update: {},
      create: {
        balance: 0,
        userId
      }
    }),
    prisma.rewardSpinWheel.findMany({
      where: {
        status: "active"
      },
      include: {
        segments: {
          where: {
            status: "active"
          },
          orderBy: [
            {
              sortOrder: "asc"
            },
            {
              createdAt: "asc"
            },
            {
              id: "asc"
            }
          ]
        }
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          name: "asc"
        }
      ]
    }),
    prisma.prizeClaim.findMany({
      where: {
        userId,
        wheelId: {
          not: null
        }
      },
      include: {
        segment: true,
        wheel: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    })
  ]);
  const latestClaimByWheelId = new Map<string, Date>();

  for (const claim of claims) {
    if (claim.wheelId && !latestClaimByWheelId.has(claim.wheelId)) {
      latestClaimByWheelId.set(claim.wheelId, claim.createdAt);
    }
  }

  return {
    recentClaims: claims.map((claim) => ({
      createdAt: claim.createdAt.toISOString(),
      description: claim.description,
      id: claim.id,
      prizeType: claim.prizeType,
      segmentLabel: claim.segment?.label ?? null,
      starAmount: claim.starAmount,
      status: claim.status,
      title: claim.title,
      wheelName: claim.wheel?.name ?? null
    })),
    walletBalance: wallet.balance,
    wheels: wheels.map((wheel) => {
      const totalWeight = getRewardWheelTotalWeight(wheel.segments);
      const cooldown = getRewardWheelCooldownState({
        cooldownMinutes: wheel.cooldownMinutes,
        lastSpinAt: latestClaimByWheelId.get(wheel.id) ?? null
      });
      const costState = getRewardWheelSpinCostState({
        costStars: wheel.costStars,
        walletBalance: wallet.balance
      });
      const hasSegments = totalWeight > 0;
      const unavailableReason = !hasSegments
        ? "This wheel needs active prize segments."
        : !costState.canAfford
          ? `You need ${costState.missingStars.toLocaleString("en-GB")} more stars to spin this wheel.`
          : !cooldown.available
            ? `Available again ${cooldown.retryAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(cooldown.retryAt) : "soon"}.`
            : null;

      return {
        canSpin: hasSegments && costState.canAfford && cooldown.available,
        cooldownMinutes: wheel.cooldownMinutes,
        cooldownRemainingSeconds: cooldown.remainingSeconds,
        cooldownRetryAt: cooldown.retryAt?.toISOString() ?? null,
        costStars: wheel.costStars,
        description: wheel.description,
        id: wheel.id,
        name: wheel.name,
        segments: wheel.segments.map((segment) => ({
          id: segment.id,
          label: segment.label,
          oddsPercent: totalWeight > 0 ? Math.round((segment.weight / totalWeight) * 1000) / 10 : 0,
          prizeType: segment.prizeType,
          starAmount: segment.starAmount,
          weight: segment.weight
        })),
        slug: wheel.slug,
        totalWeight,
        unavailableReason
      };
    })
  };
}

export async function spinRewardWheel(userId: string, wheelId: string): Promise<RewardWheelSpinResult> {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const wheel = await tx.rewardSpinWheel.findFirst({
      where: {
        id: wheelId,
        status: "active"
      },
      include: {
        segments: {
          where: {
            status: "active"
          },
          orderBy: [
            {
              sortOrder: "asc"
            },
            {
              createdAt: "asc"
            },
            {
              id: "asc"
            }
          ]
        }
      }
    });

    if (!wheel) {
      throw new RewardWheelSpinError("That reward wheel is not available.", "invalid-wheel");
    }

    const totalWeight = getRewardWheelTotalWeight(wheel.segments);

    if (totalWeight <= 0) {
      throw new RewardWheelSpinError("That reward wheel has no active prize segments.", "no-segments");
    }

    const latestClaim = await tx.prizeClaim.findFirst({
      where: {
        userId,
        wheelId: wheel.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const cooldown = getRewardWheelCooldownState({
      cooldownMinutes: wheel.cooldownMinutes,
      lastSpinAt: latestClaim?.createdAt ?? null,
      now
    });

    if (!cooldown.available) {
      throw new RewardWheelSpinError("This reward wheel is still cooling down.", "cooldown");
    }

    const wallet = await tx.starWallet.upsert({
      where: {
        userId
      },
      update: {},
      create: {
        balance: 0,
        userId
      }
    });

    const costState = getRewardWheelSpinCostState({
      costStars: wheel.costStars,
      walletBalance: wallet.balance
    });

    if (!costState.canAfford) {
      throw new RewardWheelSpinError("You do not have enough stars to spin this wheel.", "insufficient-stars");
    }

    const winningSegment = pickWeightedRewardSegment(wheel.segments);
    const status = rewardWheelResultStatus(winningSegment.prizeType);
    let walletBalance = wallet.balance;

    if (wheel.costStars > 0) {
      const debit = await tx.starWallet.updateMany({
        where: {
          balance: {
            gte: wheel.costStars
          },
          userId
        },
        data: {
          balance: {
            decrement: wheel.costStars
          }
        }
      });

      if (debit.count !== 1) {
        throw new RewardWheelSpinError("You do not have enough stars to spin this wheel.", "insufficient-stars");
      }

      const debitedWallet = await tx.starWallet.findUniqueOrThrow({
        where: {
          userId
        }
      });
      walletBalance = debitedWallet.balance;
    }

    const claim = await tx.prizeClaim.create({
      data: {
        description:
          winningSegment.prizeType === "none"
            ? "Reward wheel spin result. No prize fulfilment is required."
            : "Reward wheel spin result. Admin fulfilment may be required.",
        prizeType: winningSegment.prizeType,
        prizeValue: winningSegment.prizeValue,
        segmentId: winningSegment.id,
        starAmount: winningSegment.starAmount,
        status,
        title: winningSegment.label,
        userId,
        wheelId: wheel.id
      }
    });

    await tx.notification.create({
      data: {
        actionUrl: `/account/rewards#reward-claim-${claim.id}`,
        body:
          status === "fulfilled"
            ? `Your ${wheel.name} spin landed on ${winningSegment.label}.`
            : `Your ${wheel.name} spin landed on ${winningSegment.label}. Admin review is pending.`,
        title: "Reward wheel result",
        type: "rewards.wheel_spin",
        userId
      }
    });

    return {
      claim,
      segment: winningSegment,
      status,
      walletBalance,
      wheel
    };
  });

  await writeAuditLog({
    actorId: userId,
    action: "rewards.wheel.spin",
    target: `reward-wheel:${result.wheel.id}`,
    severity: result.status === "pending" ? "warning" : "info",
    metadata: {
      claimId: result.claim.id,
      costStars: result.wheel.costStars,
      prizeType: result.segment.prizeType,
      segmentId: result.segment.id,
      userId
    }
  });

  return {
    claimId: result.claim.id,
    message:
      result.status === "fulfilled"
        ? `Wheel stopped on ${result.segment.label}.`
        : `Wheel stopped on ${result.segment.label}. Your prize claim is pending admin fulfilment.`,
    prizeType: result.segment.prizeType,
    segmentId: result.segment.id,
    segmentLabel: result.segment.label,
    status: result.status,
    walletBalance: result.walletBalance,
    wheelId: result.wheel.id,
    wheelName: result.wheel.name
  };
}

export async function createManualPrizeClaim(input: PrizeClaimInput, actorId: string) {
  const prizeType = input.prizeType.trim();
  assertPrizeType(prizeType);

  const starAmount = parseInteger(input.starAmount, "Prize quantity", 0, 1000000);

  const wheelId = input.wheelId?.trim() || null;
  const segmentId = input.segmentId?.trim() || null;

  const claim = await prisma.prizeClaim.create({
    data: {
      description: normalizedText(input.description, 600),
      prizeType,
      prizeValue: normalizedText(input.prizeValue, 240),
      segmentId,
      starAmount,
      status: "pending",
      title: normalizedRequiredText(input.title, 120, "Prize title"),
      userId: input.userId,
      wheelId
    }
  });

  await prisma.notification.create({
    data: {
      body: "A reward prize claim has been created and is awaiting review.",
      title: claim.title,
      type: "rewards.prize_claim",
      userId: claim.userId
    }
  });

  await writeAuditLog({
    actorId,
    action: "rewards.prize_claim.create",
    target: `prize-claim:${claim.id}`,
    severity: "warning",
    metadata: {
      prizeType,
      starAmount,
      userId: claim.userId
    }
  });

  return claim;
}

export async function updatePrizeClaimStatus(input: PrizeClaimStatusInput, actorId: string) {
  const status = input.status.trim();
  assertClaimStatus(status);

  const current = await prisma.prizeClaim.findUniqueOrThrow({
    where: {
      id: input.claimId
    }
  });
  const resolved = status === "fulfilled" || status === "rejected";

  const claim = await prisma.$transaction(async (tx) => {
    const updated = await tx.prizeClaim.update({
      where: {
        id: current.id
      },
      data: {
        fulfilmentNote: normalizedText(input.fulfilmentNote, 600),
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? actorId : null,
        starsCreditedAt: current.starsCreditedAt,
        status
      }
    });

    await tx.notification.create({
      data: {
        body:
          status === "fulfilled"
            ? "Your reward prize claim has been fulfilled."
            : status === "rejected"
              ? "Your reward prize claim was rejected."
              : "Your reward prize claim status has been updated.",
        title: updated.title,
        type: "rewards.prize_claim_status",
        userId: updated.userId
      }
    });

    return updated;
  });

  await writeAuditLog({
    actorId,
    action: "rewards.prize_claim.status_update",
    target: `prize-claim:${claim.id}`,
    severity: status === "fulfilled" ? "warning" : "info",
    metadata: {
      creditedStars: 0,
      status,
      userId: claim.userId
    }
  });

  return claim;
}
