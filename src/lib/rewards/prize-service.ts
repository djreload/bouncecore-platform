import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeRoles } from "@/lib/auth/role-normalize";
import type { Role } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";

export const rewardWheelStatuses = ["draft", "active", "paused", "archived"] as const;
export const rewardSegmentStatuses = ["active", "disabled"] as const;
export const rewardPrizeTypes = ["none", "stars", "merch", "music", "vip", "manual"] as const;
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
  starAmount: string;
  status: string;
  weight: string;
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
  const [wheels, claimsPending] = await Promise.all([
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
              status: "asc"
            },
            {
              weight: "desc"
            },
            {
              label: "asc"
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
    })
  ]);
  const segments = wheels.flatMap((wheel) => wheel.segments);

  return {
    claimsPending,
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
        starAmount: segment.starAmount,
        status: segment.status,
        weight: segment.weight
      })),
      slug: wheel.slug,
      status: wheel.status,
      totalWeight: wheel.segments.reduce((total, segment) => total + (segment.status === "active" ? segment.weight : 0), 0)
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
      description: "Starter supporter rewards wheel. Keep in draft until prize rules are approved.",
      name: "Supporter Wheel",
      slug: "supporter-wheel",
      status: "draft",
      segments: {
        create: [
          {
            label: "100 stars",
            prizeType: "stars",
            starAmount: 100,
            weight: 25
          },
          {
            label: "VIP shoutout",
            prizeType: "vip",
            prizeValue: "shoutout",
            weight: 10
          },
          {
            label: "Try again",
            prizeType: "none",
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

  const starAmount = parseInteger(input.starAmount, "Star amount", 0, 1000000);

  if (prizeType === "stars" && starAmount < 1) {
    throw new Error("Star prize segments must include a positive star amount.");
  }

  const data = {
    label: normalizedRequiredText(input.label, 120, "Segment label"),
    prizeType,
    prizeValue: normalizedText(input.prizeValue, 240),
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

export async function createManualPrizeClaim(input: PrizeClaimInput, actorId: string) {
  const prizeType = input.prizeType.trim();
  assertPrizeType(prizeType);

  const starAmount = parseInteger(input.starAmount, "Star amount", 0, 1000000);

  if (prizeType === "stars" && starAmount < 1) {
    throw new Error("Star prize claims must include a positive star amount.");
  }

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
  const shouldCreditStars = status === "fulfilled" && current.starAmount > 0 && !current.starsCreditedAt;

  const claim = await prisma.$transaction(async (tx) => {
    if (shouldCreditStars) {
      await tx.starWallet.upsert({
        where: {
          userId: current.userId
        },
        update: {
          balance: {
            increment: current.starAmount
          }
        },
        create: {
          balance: current.starAmount,
          userId: current.userId
        }
      });
    }

    const updated = await tx.prizeClaim.update({
      where: {
        id: current.id
      },
      data: {
        fulfilmentNote: normalizedText(input.fulfilmentNote, 600),
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? actorId : null,
        starsCreditedAt: shouldCreditStars ? new Date() : current.starsCreditedAt,
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
      creditedStars: shouldCreditStars ? current.starAmount : 0,
      status,
      userId: claim.userId
    }
  });

  return claim;
}
