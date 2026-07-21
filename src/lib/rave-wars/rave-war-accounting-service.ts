import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { publishRaveWarChanged } from "@/lib/rave-wars/rave-war-realtime";
import { raveWarEntryRefundEligibility } from "@/lib/rave-wars/rave-war-accounting-core";

async function nextRefundEventSequence(tx: Prisma.TransactionClient, warId: string) {
  const latest = await tx.raveWarEvent.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true },
    where: { warId }
  });

  return (latest?.sequence ?? 0) + 1;
}

export async function refundRaveWarEntryStars(
  tx: Prisma.TransactionClient,
  input: { actorId?: string | null; reason: string; warId: string }
) {
  const war = await tx.raveWar.findUniqueOrThrow({
    select: {
      challengerId: true,
      entryStars: true,
      entryStarsRefundedAt: true,
      status: true
    },
    where: { id: input.warId }
  });
  const eligibility = raveWarEntryRefundEligibility(war);

  if (!eligibility.eligible) {
    return {
      amount: war.entryStars,
      eventId: null,
      reason: eligibility.reason,
      refunded: false
    };
  }

  const refundedAt = new Date();
  const claim = await tx.raveWar.updateMany({
    data: {
      entryStarsRefundedAt: refundedAt,
      entryStarsRefundedById: input.actorId ?? null,
      entryStarsRefundReason: input.reason
    },
    where: {
      entryStarsRefundedAt: null,
      id: input.warId,
      status: { in: ["cancelled", "declined", "expired"] }
    }
  });

  if (claim.count !== 1) {
    return {
      amount: war.entryStars,
      eventId: null,
      reason: "The refund was already processed or the challenge status changed.",
      refunded: false
    };
  }

  await tx.starWallet.upsert({
    create: {
      balance: war.entryStars,
      userId: war.challengerId
    },
    update: {
      balance: { increment: war.entryStars }
    },
    where: { userId: war.challengerId }
  });
  const event = await tx.raveWarEvent.create({
    data: {
      payload: {
        amount: war.entryStars,
        reason: input.reason,
        refundedAt: refundedAt.toISOString()
      },
      sequence: await nextRefundEventSequence(tx, input.warId),
      type: "challenge.entry-refunded",
      userId: input.actorId ?? null,
      warId: input.warId
    }
  });

  return {
    amount: war.entryStars,
    eventId: event.id,
    reason: null,
    refunded: true
  };
}

export async function refundRaveWarEntryStarsByAdmin(warId: string, actorId: string, reason: string) {
  const result = await prisma.$transaction(async (tx) => {
    const refund = await refundRaveWarEntryStars(tx, { actorId, reason, warId });

    if (!refund.refunded) {
      throw new Error(refund.reason ?? "Rave War entry refund could not be processed.");
    }

    await tx.auditLog.create({
      data: {
        action: "chat.rave_war.admin.entry_refund",
        actorId,
        metadata: {
          amount: refund.amount,
          eventId: refund.eventId,
          reason
        },
        severity: "warning",
        target: `rave-war:${warId}`
      }
    });

    return refund;
  });

  if (result.eventId) {
    await publishRaveWarChanged(warId, result.eventId);
  }

  return result;
}
