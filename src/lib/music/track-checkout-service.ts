import { writeAuditLog } from "@/lib/auth/audit";
import {
  capturePayPalCheckoutOrder,
  createPayPalCheckoutOrder,
  getPayPalMusicReadiness,
  getPayPalSettings
} from "@/lib/payments/paypal-service";
import { prisma } from "@/lib/db/prisma";

const musicCurrency = "GBP";
const platformFeeRate = 0.15;

export type StartTrackCheckoutInput = {
  origin: string;
  trackId: string;
};

function checkoutUrl(origin: string, path: string, params: Record<string, string>) {
  const url = new URL(path, origin);

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  return url.toString();
}

function producerEarnings(pricePence: number) {
  const platformFeePence = Math.round(pricePence * platformFeeRate);

  return {
    platformFeePence,
    producerEarningsPence: Math.max(0, pricePence - platformFeePence)
  };
}

async function loadCheckoutTrack(trackId: string) {
  if (!trackId) {
    throw new Error("Choose a music track.");
  }

  const track = await prisma.digitalTrack.findUnique({
    where: {
      id: trackId
    },
    include: {
      producer: true
    }
  });

  if (!track || track.status !== "approved") {
    throw new Error("That music track is not available for checkout.");
  }

  if (track.pricePence <= 0) {
    throw new Error("Free tracks cannot use PayPal checkout.");
  }

  return track;
}

export async function startTrackCheckout(userId: string, input: StartTrackCheckoutInput) {
  const [settings, track] = await Promise.all([getPayPalSettings(), loadCheckoutTrack(input.trackId)]);
  const readiness = getPayPalMusicReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal music checkout is not ready.");
  }

  if (track.producer.userId === userId) {
    throw new Error("You cannot buy your own track.");
  }

  const existingPaidPurchase = await prisma.digitalTrackPurchase.findFirst({
    where: {
      buyerId: userId,
      status: "paid",
      trackId: track.id
    },
    select: {
      id: true
    }
  });

  if (existingPaidPurchase) {
    throw new Error("You already own this track.");
  }

  const earnings = producerEarnings(track.pricePence);
  const purchase = await prisma.digitalTrackPurchase.create({
    data: {
      buyerId: userId,
      currency: musicCurrency,
      downloadUrl: track.downloadUrl,
      licenseSummary: track.licenseSummary,
      licenseType: track.licenseType,
      platformFeePence: earnings.platformFeePence,
      pricePence: track.pricePence,
      producerEarningsPence: earnings.producerEarningsPence,
      producerId: track.producerId,
      producerName: track.producer.name,
      status: "pending",
      trackId: track.id,
      trackTitle: track.title
    }
  });

  try {
    const paypal = await createPayPalCheckoutOrder(
      {
        cancelUrl: checkoutUrl(input.origin, "/music/checkout/cancel", {
          purchaseId: purchase.id
        }),
        currencyCode: musicCurrency,
        description: `${track.title} by ${track.producer.name}`.slice(0, 120),
        items: [
          {
            category: "DIGITAL_GOODS",
            name: track.title,
            quantity: 1,
            sku: `TRACK-${track.id.slice(0, 12).toUpperCase()}`,
            unitAmountPence: track.pricePence
          }
        ],
        localOrderId: purchase.id,
        returnUrl: checkoutUrl(input.origin, "/music/checkout/return", {
          purchaseId: purchase.id
        }),
        totalPence: track.pricePence
      },
      settings
    );

    await prisma.digitalTrackPurchase.update({
      where: {
        id: purchase.id
      },
      data: {
        paypalOrderId: paypal.paypalOrderId
      }
    });

    await writeAuditLog({
      actorId: userId,
      action: "music.checkout.start",
      target: `track-purchase:${purchase.id}`,
      severity: "info",
      metadata: {
        paypalOrderId: paypal.paypalOrderId,
        producerEarningsPence: purchase.producerEarningsPence,
        trackId: track.id,
        totalPence: purchase.pricePence
      }
    });

    return {
      approvalUrl: paypal.approvalUrl,
      purchaseId: purchase.id
    };
  } catch (error) {
    await prisma.digitalTrackPurchase.delete({
      where: {
        id: purchase.id
      }
    });

    throw error;
  }
}

export async function completeTrackCheckout(userId: string, purchaseId: string, paypalOrderId: string) {
  if (!purchaseId || !paypalOrderId) {
    throw new Error("Missing PayPal music checkout details.");
  }

  const purchase = await prisma.digitalTrackPurchase.findFirst({
    where: {
      buyerId: userId,
      id: purchaseId
    }
  });

  if (!purchase) {
    throw new Error("Music purchase not found.");
  }

  if (purchase.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this music purchase.");
  }

  if (purchase.status === "paid") {
    return purchase;
  }

  if (purchase.status !== "pending") {
    throw new Error("This music purchase can no longer be captured.");
  }

  const settings = await getPayPalSettings();
  const capture = await capturePayPalCheckoutOrder(paypalOrderId, settings);

  if (capture.status !== "COMPLETED") {
    throw new Error(`PayPal capture returned ${capture.status}.`);
  }

  if (capture.amountPence !== null && capture.amountPence !== purchase.pricePence) {
    throw new Error("PayPal captured amount did not match this music purchase.");
  }

  const update = await prisma.digitalTrackPurchase.updateMany({
    where: {
      id: purchase.id,
      status: "pending"
    },
    data: {
      completedAt: new Date(),
      paypalCaptureId: capture.captureId,
      paypalPayerEmail: capture.payerEmail,
      status: "paid"
    }
  });

  if (update.count !== 1) {
    throw new Error("This music purchase was already processed.");
  }

  const updated = await prisma.digitalTrackPurchase.findUniqueOrThrow({
    where: {
      id: purchase.id
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "music.checkout.capture",
    target: `track-purchase:${updated.id}`,
    severity: "warning",
    metadata: {
      paypalCaptureId: updated.paypalCaptureId,
      paypalOrderId: updated.paypalOrderId,
      producerEarningsPence: updated.producerEarningsPence,
      trackId: updated.trackId,
      totalPence: updated.pricePence
    }
  });

  return updated;
}

export async function cancelTrackCheckout(userId: string, purchaseId: string, paypalOrderId?: string) {
  if (!purchaseId) {
    throw new Error("Missing music purchase.");
  }

  const purchase = await prisma.digitalTrackPurchase.findFirst({
    where: {
      buyerId: userId,
      id: purchaseId
    }
  });

  if (!purchase) {
    return null;
  }

  if (paypalOrderId && purchase.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this music purchase.");
  }

  if (purchase.status !== "pending") {
    return purchase;
  }

  const updated = await prisma.digitalTrackPurchase.update({
    where: {
      id: purchase.id
    },
    data: {
      cancelledAt: new Date(),
      status: "cancelled"
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "music.checkout.cancel",
    target: `track-purchase:${updated.id}`,
    severity: "info",
    metadata: {
      paypalOrderId: updated.paypalOrderId,
      trackId: updated.trackId,
      totalPence: updated.pricePence
    }
  });

  return updated;
}
