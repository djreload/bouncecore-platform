import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { squareWebhookEnvelopeFromPayload } from "@/lib/payments/square-service";
import { reconcileCompletedPaymentRefund } from "@/lib/payments/payment-refund-service";
import { completeSquareStarsCheckout } from "@/lib/rewards/stars-checkout-service";
import { completeSquareShopCheckout } from "@/lib/shop/checkout-service";

const squareWebhookMaxRetries = 5;

export async function recordSquareWebhookEvent(payload: unknown) {
  const envelope = squareWebhookEnvelopeFromPayload(payload);

  if (!envelope) {
    throw new Error("Square webhook event identifier or type is missing.");
  }

  const existing = await prisma.squareWebhookEvent.findUnique({ where: { squareEventId: envelope.eventId } });

  if (existing) {
    return { duplicate: true, event: existing };
  }

  try {
    const event = await prisma.squareWebhookEvent.create({
      data: {
        eventType: envelope.eventType,
        payload: payload as Prisma.InputJsonValue,
        squareEventId: envelope.eventId,
        squareOrderId: envelope.payment?.squareOrderId ?? envelope.refund?.squareOrderId ?? null,
        squarePaymentId: envelope.payment?.paymentId ?? envelope.refund?.squarePaymentId ?? null
      }
    });

    return { duplicate: false, event };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        duplicate: true,
        event: await prisma.squareWebhookEvent.findUniqueOrThrow({ where: { squareEventId: envelope.eventId } })
      };
    }

    throw error;
  }
}

async function reconcileSquarePayload(payload: unknown) {
  const envelope = squareWebhookEnvelopeFromPayload(payload);
  const payment = envelope?.payment;
  const refund = envelope?.refund;

  if (envelope && refund?.status === "COMPLETED" && refund.amountPence) {
    const result = await reconcileCompletedPaymentRefund({
      amountPence: refund.amountPence,
      currency: refund.currency,
      provider: "square",
      providerEventId: envelope.eventId,
      squareOrderId: refund.squareOrderId,
      squarePaymentId: refund.squarePaymentId
    });

    return { action: `refund-${result.status}`, target: result.recordId, type: result.type } as const;
  }

  if (!payment || payment.status !== "COMPLETED") {
    return { action: "ignored", target: null, type: null } as const;
  }

  const [starPurchase, shopOrder] = await Promise.all([
    prisma.starPurchase.findUnique({
      select: { id: true, status: true, userId: true },
      where: { squareOrderId: payment.squareOrderId }
    }),
    prisma.order.findUnique({
      select: { id: true, status: true, userId: true },
      where: { squareOrderId: payment.squareOrderId }
    })
  ]);

  if (starPurchase) {
    await completeSquareStarsCheckout(starPurchase.userId, starPurchase.id);
    return { action: starPurchase.status === "pending" ? "processed" : "duplicate", target: starPurchase.id, type: "stars" } as const;
  }

  if (shopOrder) {
    await completeSquareShopCheckout(shopOrder.userId, shopOrder.id);
    return { action: shopOrder.status === "pending" ? "processed" : "duplicate", target: shopOrder.id, type: "shop" } as const;
  }

  return { action: "recorded", target: null, type: null } as const;
}

export async function processStoredSquareWebhookEvent(eventId: string) {
  const claim = await prisma.squareWebhookEvent.updateMany({
    data: {
      errorMessage: null,
      processingStatus: "processing",
      retryCount: { increment: 1 }
    },
    where: {
      id: eventId,
      processingStatus: { in: ["received", "failed"] },
      retryCount: { lt: squareWebhookMaxRetries }
    }
  });

  if (claim.count !== 1) {
    return { action: "duplicate", target: null, type: null } as const;
  }

  const event = await prisma.squareWebhookEvent.findUniqueOrThrow({ where: { id: eventId } });

  try {
    const result = await reconcileSquarePayload(event.payload);

    await prisma.squareWebhookEvent.update({
      data: {
        errorMessage: null,
        processedAt: new Date(),
        processingStatus: result.action
      },
      where: { id: event.id }
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Square webhook processing failed.";

    await prisma.squareWebhookEvent.update({
      data: {
        errorMessage,
        processedAt: new Date(),
        processingStatus: "failed"
      },
      where: { id: event.id }
    });
    await writeAuditLog({
      action: "payments.square.webhook.failed",
      actorId: null,
      metadata: {
        errorMessage,
        eventType: event.eventType,
        retryCount: event.retryCount,
        squareEventId: event.squareEventId,
        squareOrderId: event.squareOrderId
      },
      severity: "critical",
      target: `square-webhook:${event.squareEventId}`
    });

    throw error;
  }
}

export async function retryPendingSquareWebhookEvents() {
  const retryBefore = new Date(Date.now() - 10_000);
  const events = await prisma.squareWebhookEvent.findMany({
    orderBy: { receivedAt: "asc" },
    select: { id: true },
    take: 25,
    where: {
      processingStatus: { in: ["received", "failed"] },
      receivedAt: { lt: retryBefore },
      retryCount: { lt: squareWebhookMaxRetries }
    }
  });
  let failed = 0;
  let processed = 0;

  for (const event of events) {
    try {
      const result = await processStoredSquareWebhookEvent(event.id);
      if (result.action !== "duplicate") processed += 1;
    } catch {
      failed += 1;
    }
  }

  return { attempted: events.length, failed, processed };
}
