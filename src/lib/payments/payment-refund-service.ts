import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { nextRefundTotal, paymentRefundStatus, proportionalStarRefund } from "@/lib/payments/payment-refund-core";

export type CompletedPaymentRefund = {
  amountPence: number;
  currency: string | null;
  paypalCaptureId?: string | null;
  provider: "paypal" | "square";
  providerEventId: string;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
};

function matchingCurrency(expected: string, incoming: string | null) {
  return !incoming || expected.toUpperCase() === incoming.toUpperCase();
}

export async function reconcileCompletedPaymentRefund(input: CompletedPaymentRefund) {
  if (!Number.isInteger(input.amountPence) || input.amountPence <= 0) {
    throw new Error("Refund amount must be a positive whole number of pence.");
  }

  const paypalCaptureId = input.paypalCaptureId ?? "__missing__";
  const squareWhere = {
    OR: [
      ...(input.squarePaymentId ? [{ squarePaymentId: input.squarePaymentId }] : []),
      ...(input.squareOrderId ? [{ squareOrderId: input.squareOrderId }] : [])
    ]
  };
  const [starPurchase, order, musicCheckout, trackPurchase] = await Promise.all([
    input.provider === "paypal"
      ? prisma.starPurchase.findFirst({ where: { paypalCaptureId } })
      : prisma.starPurchase.findFirst({ where: squareWhere }),
    input.provider === "paypal"
      ? prisma.order.findFirst({ include: { items: true }, where: { paypalCaptureId } })
      : prisma.order.findFirst({ include: { items: true }, where: squareWhere }),
    input.provider === "paypal"
      ? prisma.musicCheckout.findFirst({ include: { purchases: true }, where: { paypalCaptureId } })
      : null,
    input.provider === "paypal" ? prisma.digitalTrackPurchase.findFirst({ where: { paypalCaptureId } }) : null
  ]);

  if (starPurchase) {
    if (!matchingCurrency(starPurchase.currency, input.currency)) throw new Error("Refund currency did not match the stars purchase.");

    const result = await prisma.$transaction(async (tx) => {
      const refundedPence = nextRefundTotal(starPurchase.refundedPence, input.amountPence, starPurchase.totalPence);
      const refundedStars = proportionalStarRefund({
        alreadyRefundedStars: starPurchase.refundedStars,
        incomingRefundPence: refundedPence,
        purchasePence: starPurchase.totalPence,
        purchasedStars: starPurchase.stars
      });
      const claim = await tx.starPurchase.updateMany({
        data: {
          refundedAt: new Date(),
          refundedPence,
          refundedStars: Math.min(starPurchase.stars, starPurchase.refundedStars + refundedStars),
          status: paymentRefundStatus(refundedPence, starPurchase.totalPence)
        },
        where: { id: starPurchase.id, refundedPence: starPurchase.refundedPence }
      });

      if (claim.count !== 1) throw new Error("Stars refund state changed; retry reconciliation.");

      const wallet = await tx.starWallet.findUnique({ where: { userId: starPurchase.userId } });
      const starsRemoved = Math.min(wallet?.balance ?? 0, refundedStars);

      if (wallet && starsRemoved > 0) {
        await tx.starWallet.update({ data: { balance: { decrement: starsRemoved } }, where: { id: wallet.id } });
      }

      const updated = await tx.starPurchase.findUniqueOrThrow({ where: { id: starPurchase.id } });

      return { recordId: updated.id, starsRemoved, status: updated.status, type: "stars" as const };
    });

    await writeAuditLog({ action: "payments.refund.reconcile", actorId: null, metadata: { ...input, ...result }, severity: "warning", target: `star-purchase:${result.recordId}` });
    return result;
  }

  if (order) {
    if (!matchingCurrency(order.currency, input.currency)) throw new Error("Refund currency did not match the shop order.");

    const result = await prisma.$transaction(async (tx) => {
      const refundedPence = nextRefundTotal(order.refundedPence, input.amountPence, order.totalPence);
      const status = paymentRefundStatus(refundedPence, order.totalPence);
      const shouldRestock = status === "refunded" && order.status !== "fulfilled" && !order.restockedAt;
      const restockedAt = shouldRestock ? new Date() : order.restockedAt;
      const claim = await tx.order.updateMany({
        data: { refundedAt: new Date(), refundedPence, restockedAt, status },
        where: { id: order.id, refundedPence: order.refundedPence, restockedAt: order.restockedAt }
      });

      if (claim.count !== 1) throw new Error("Shop refund state changed; retry reconciliation.");

      if (shouldRestock) {
        for (const item of order.items) {
          if (item.productVariantId) {
            await tx.productVariant.update({ data: { stock: { increment: item.quantity } }, where: { id: item.productVariantId } });
          }
        }
      }

      const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id } });

      return { recordId: updated.id, restocked: shouldRestock, status: updated.status, type: "shop" as const };
    });

    await writeAuditLog({ action: "payments.refund.reconcile", actorId: null, metadata: { ...input, ...result }, severity: "warning", target: `order:${result.recordId}` });
    return result;
  }

  if (musicCheckout) {
    if (!matchingCurrency(musicCheckout.currency, input.currency)) throw new Error("Refund currency did not match the music checkout.");
    const refundedPence = nextRefundTotal(musicCheckout.refundedPence, input.amountPence, musicCheckout.totalPence);
    const status = paymentRefundStatus(refundedPence, musicCheckout.totalPence);

    await prisma.$transaction(async (tx) => {
      const claim = await tx.musicCheckout.updateMany({
        data: { refundedAt: new Date(), refundedPence, status },
        where: { id: musicCheckout.id, refundedPence: musicCheckout.refundedPence }
      });

      if (claim.count !== 1) throw new Error("Music checkout refund state changed; retry reconciliation.");

      if (status === "refunded") {
        for (const purchase of musicCheckout.purchases) {
          await tx.digitalTrackPurchase.update({
            data: { downloadUrl: null, refundedAt: new Date(), refundedPence: purchase.pricePence, status: "refunded" },
            where: { id: purchase.id }
          });
          await tx.producerPayoutItem.updateMany({
            data: { errorMessage: "Purchase was refunded before payout.", status: "blocked" },
            where: { purchaseId: purchase.id, status: "pending" }
          });
        }
      }
    });
    const result = { manualAllocationRequired: status !== "refunded", recordId: musicCheckout.id, status, type: "music-cart" as const };
    await writeAuditLog({ action: "payments.refund.reconcile", actorId: null, metadata: { ...input, ...result }, severity: status === "refunded" ? "warning" : "critical", target: `music-checkout:${musicCheckout.id}` });
    return result;
  }

  if (trackPurchase) {
    if (!matchingCurrency(trackPurchase.currency, input.currency)) throw new Error("Refund currency did not match the music purchase.");
    const refundedPence = nextRefundTotal(trackPurchase.refundedPence, input.amountPence, trackPurchase.pricePence);
    const status = paymentRefundStatus(refundedPence, trackPurchase.pricePence);
    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.digitalTrackPurchase.updateMany({
        data: { downloadUrl: status === "refunded" ? null : trackPurchase.downloadUrl, refundedAt: new Date(), refundedPence, status },
        where: { id: trackPurchase.id, refundedPence: trackPurchase.refundedPence }
      });

      if (claim.count !== 1) throw new Error("Music purchase refund state changed; retry reconciliation.");

      if (status === "refunded") {
        await tx.producerPayoutItem.updateMany({
          data: { errorMessage: "Purchase was refunded before payout.", status: "blocked" },
          where: { purchaseId: trackPurchase.id, status: "pending" }
        });
      }

      return tx.digitalTrackPurchase.findUniqueOrThrow({ where: { id: trackPurchase.id } });
    });
    const result = { recordId: updated.id, status: updated.status, type: "music" as const };
    await writeAuditLog({ action: "payments.refund.reconcile", actorId: null, metadata: { ...input, ...result }, severity: "warning", target: `track-purchase:${updated.id}` });
    return result;
  }

  return { recordId: null, status: "unmatched", type: null } as const;
}
