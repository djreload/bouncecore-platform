import { writeAuditLog } from "@/lib/auth/audit";
import { notifyMusicCheckoutPaid, notifyMusicPurchasePaid } from "@/lib/checkout/checkout-confirmation-service";
import {
  capturePayPalCheckoutOrder,
  createPayPalCheckoutOrder,
  getPayPalMusicReadiness,
  getPayPalSettings
} from "@/lib/payments/paypal-service";
import { prisma } from "@/lib/db/prisma";

const musicCurrency = "GBP";
const platformFeeRate = 0.15;
const maxCartTracks = 20;

export type StartTrackCheckoutInput = {
  origin: string;
  trackId: string;
};

export type StartTrackCartCheckoutInput = {
  origin: string;
  trackIds: string[];
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

function assertTrackHasDelivery(track: { downloadUrl: string | null }) {
  if (!track.downloadUrl) {
    throw new Error("Music checkout cannot start until the track has a download MP3 or Google Drive delivery link.");
  }
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

  assertTrackHasDelivery(track);

  return track;
}

type CheckoutTrack = Awaited<ReturnType<typeof loadCheckoutTrack>>;

function uniqueTrackIds(trackIds: string[]) {
  const ids = [
    ...new Set(
      trackIds
        .map((trackId) => trackId.trim())
        .filter(Boolean)
    )
  ];

  if (!ids.length) {
    throw new Error("Choose at least one music track.");
  }

  if (ids.length > maxCartTracks) {
    throw new Error(`Music basket checkout supports up to ${maxCartTracks} tracks at a time.`);
  }

  return ids;
}

async function loadCheckoutTracks(trackIds: string[]) {
  const ids = uniqueTrackIds(trackIds);
  const tracks = await prisma.digitalTrack.findMany({
    where: {
      id: {
        in: ids
      }
    },
    include: {
      producer: true
    }
  });
  const tracksById = new Map(tracks.map((track) => [track.id, track]));

  return ids.map((id) => {
    const track = tracksById.get(id);

    if (!track || track.status !== "approved") {
      throw new Error("One or more music tracks are not available for checkout.");
    }

    if (track.pricePence <= 0) {
      throw new Error("Free tracks cannot use PayPal checkout.");
    }

    assertTrackHasDelivery(track);

    return track;
  });
}

function trackPurchaseData(userId: string, track: CheckoutTrack) {
  const earnings = producerEarnings(track.pricePence);

  return {
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
  };
}

async function assertPurchasableTracks(userId: string, tracks: CheckoutTrack[]) {
  const ownTrack = tracks.find((track) => track.producer.userId === userId);

  if (ownTrack) {
    throw new Error("You cannot buy your own track.");
  }

  const existingPaidPurchases = await prisma.digitalTrackPurchase.findMany({
    where: {
      buyerId: userId,
      status: "paid",
      trackId: {
        in: tracks.map((track) => track.id)
      }
    },
    select: {
      trackTitle: true
    }
  });

  if (existingPaidPurchases.length) {
    throw new Error(`You already own ${existingPaidPurchases[0].trackTitle}.`);
  }
}

export async function startTrackCheckout(userId: string, input: StartTrackCheckoutInput) {
  const [settings, track] = await Promise.all([getPayPalSettings(), loadCheckoutTrack(input.trackId)]);
  const readiness = getPayPalMusicReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal music checkout is not ready.");
  }

  await assertPurchasableTracks(userId, [track]);

  const purchase = await prisma.digitalTrackPurchase.create({
    data: trackPurchaseData(userId, track)
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

export async function startTrackCartCheckout(userId: string, input: StartTrackCartCheckoutInput) {
  const [settings, tracks] = await Promise.all([getPayPalSettings(), loadCheckoutTracks(input.trackIds)]);
  const readiness = getPayPalMusicReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal music checkout is not ready.");
  }

  await assertPurchasableTracks(userId, tracks);

  const totalPence = tracks.reduce((total, track) => total + track.pricePence, 0);
  const checkout = await prisma.musicCheckout.create({
    data: {
      buyerId: userId,
      currency: musicCurrency,
      status: "pending",
      totalPence,
      purchases: {
        create: tracks.map((track) => trackPurchaseData(userId, track))
      }
    },
    include: {
      purchases: true
    }
  });

  try {
    const paypal = await createPayPalCheckoutOrder(
      {
        cancelUrl: checkoutUrl(input.origin, "/music/cart/cancel", {
          checkoutId: checkout.id
        }),
        currencyCode: musicCurrency,
        description: `${tracks.length} Bouncecore music track${tracks.length === 1 ? "" : "s"}`.slice(0, 120),
        items: tracks.map((track) => ({
          category: "DIGITAL_GOODS",
          name: track.title,
          quantity: 1,
          sku: `TRACK-${track.id.slice(0, 12).toUpperCase()}`,
          unitAmountPence: track.pricePence
        })),
        localOrderId: checkout.id,
        returnUrl: checkoutUrl(input.origin, "/music/cart/return", {
          checkoutId: checkout.id
        }),
        totalPence
      },
      settings
    );

    await prisma.musicCheckout.update({
      where: {
        id: checkout.id
      },
      data: {
        paypalOrderId: paypal.paypalOrderId
      }
    });

    await writeAuditLog({
      actorId: userId,
      action: "music.cart_checkout.start",
      target: `music-checkout:${checkout.id}`,
      severity: "info",
      metadata: {
        paypalOrderId: paypal.paypalOrderId,
        purchaseIds: checkout.purchases.map((purchase) => purchase.id),
        trackIds: tracks.map((track) => track.id),
        totalPence
      }
    });

    return {
      approvalUrl: paypal.approvalUrl,
      checkoutId: checkout.id
    };
  } catch (error) {
    await prisma.musicCheckout.delete({
      where: {
        id: checkout.id
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
    await notifyMusicPurchasePaid(purchase.id);

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

  await notifyMusicPurchasePaid(updated.id);

  return updated;
}

export async function completeTrackCartCheckout(userId: string, checkoutId: string, paypalOrderId: string) {
  if (!checkoutId || !paypalOrderId) {
    throw new Error("Missing PayPal music basket checkout details.");
  }

  const checkout = await prisma.musicCheckout.findFirst({
    where: {
      buyerId: userId,
      id: checkoutId
    },
    include: {
      purchases: true
    }
  });

  if (!checkout) {
    throw new Error("Music basket checkout not found.");
  }

  if (checkout.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this music basket checkout.");
  }

  if (checkout.status === "paid") {
    await notifyMusicCheckoutPaid(checkout.id);

    return checkout;
  }

  if (checkout.status !== "pending") {
    throw new Error("This music basket checkout can no longer be captured.");
  }

  const settings = await getPayPalSettings();
  const capture = await capturePayPalCheckoutOrder(paypalOrderId, settings);

  if (capture.status !== "COMPLETED") {
    throw new Error(`PayPal capture returned ${capture.status}.`);
  }

  if (capture.amountPence !== null && capture.amountPence !== checkout.totalPence) {
    throw new Error("PayPal captured amount did not match this music basket checkout.");
  }

  await prisma.$transaction(async (tx) => {
    const update = await tx.musicCheckout.updateMany({
      where: {
        id: checkout.id,
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
      throw new Error("This music basket checkout was already processed.");
    }

    await tx.digitalTrackPurchase.updateMany({
      where: {
        checkoutId: checkout.id,
        status: "pending"
      },
      data: {
        completedAt: new Date(),
        paypalCaptureId: capture.captureId,
        paypalPayerEmail: capture.payerEmail,
        status: "paid"
      }
    });
  });

  const updated = await prisma.musicCheckout.findUniqueOrThrow({
    where: {
      id: checkout.id
    },
    include: {
      purchases: true
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "music.cart_checkout.capture",
    target: `music-checkout:${updated.id}`,
    severity: "warning",
    metadata: {
      paypalCaptureId: updated.paypalCaptureId,
      paypalOrderId: updated.paypalOrderId,
      purchaseIds: updated.purchases.map((purchase) => purchase.id),
      totalPence: updated.totalPence
    }
  });

  await notifyMusicCheckoutPaid(updated.id);

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

export async function cancelTrackCartCheckout(userId: string, checkoutId: string, paypalOrderId?: string) {
  if (!checkoutId) {
    throw new Error("Missing music basket checkout.");
  }

  const checkout = await prisma.musicCheckout.findFirst({
    where: {
      buyerId: userId,
      id: checkoutId
    }
  });

  if (!checkout) {
    return null;
  }

  if (paypalOrderId && checkout.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this music basket checkout.");
  }

  if (checkout.status !== "pending") {
    return checkout;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.musicCheckout.update({
      where: {
        id: checkout.id
      },
      data: {
        cancelledAt: new Date(),
        status: "cancelled"
      }
    });

    await tx.digitalTrackPurchase.updateMany({
      where: {
        checkoutId: checkout.id,
        status: "pending"
      },
      data: {
        cancelledAt: new Date(),
        status: "cancelled"
      }
    });

    return cancelled;
  });

  await writeAuditLog({
    actorId: userId,
    action: "music.cart_checkout.cancel",
    target: `music-checkout:${updated.id}`,
    severity: "info",
    metadata: {
      paypalOrderId: updated.paypalOrderId,
      totalPence: updated.totalPence
    }
  });

  return updated;
}
