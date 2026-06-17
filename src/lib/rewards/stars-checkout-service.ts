import { writeAuditLog } from "@/lib/auth/audit";
import { notifyStarsPurchasePaid } from "@/lib/checkout/checkout-confirmation-service";
import {
  capturePayPalCheckoutOrder,
  createPayPalCheckoutOrder,
  getPayPalSettings,
  getPayPalStarsReadiness
} from "@/lib/payments/paypal-service";
import { prisma } from "@/lib/db/prisma";
import { getStarPackage } from "@/lib/rewards/stars-service";

const starsCurrency = "GBP";

export type StartStarsCheckoutInput = {
  origin: string;
  packageId: string;
};

function checkoutUrl(origin: string, path: string, params: Record<string, string>) {
  const url = new URL(path, origin);

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  return url.toString();
}

export async function startStarsCheckout(userId: string, input: StartStarsCheckoutInput) {
  const [settings, pack] = await Promise.all([getPayPalSettings(), Promise.resolve(getStarPackage(input.packageId))]);
  const readiness = getPayPalStarsReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal stars checkout is not ready.");
  }

  const purchase = await prisma.starPurchase.create({
    data: {
      currency: starsCurrency,
      packageLabel: pack.label,
      stars: pack.stars,
      status: "pending",
      totalPence: pack.pricePence,
      userId
    }
  });

  try {
    const paypal = await createPayPalCheckoutOrder(
      {
        cancelUrl: checkoutUrl(input.origin, "/account/rewards/stars/cancel", {
          purchaseId: purchase.id
        }),
        currencyCode: starsCurrency,
        description: `${pack.stars.toLocaleString("en-GB")} Bouncecore stars`,
        items: [
          {
            category: "DIGITAL_GOODS",
            name: pack.label,
            quantity: 1,
            sku: `STARS-${pack.id.toUpperCase()}`,
            unitAmountPence: pack.pricePence
          }
        ],
        localOrderId: purchase.id,
        returnUrl: checkoutUrl(input.origin, "/account/rewards/stars/return", {
          purchaseId: purchase.id
        }),
        totalPence: pack.pricePence
      },
      settings
    );

    await prisma.starPurchase.update({
      where: {
        id: purchase.id
      },
      data: {
        paypalOrderId: paypal.paypalOrderId
      }
    });

    await writeAuditLog({
      actorId: userId,
      action: "stars.checkout.start",
      target: `star-purchase:${purchase.id}`,
      severity: "info",
      metadata: {
        paypalOrderId: paypal.paypalOrderId,
        stars: pack.stars,
        totalPence: pack.pricePence
      }
    });

    return {
      approvalUrl: paypal.approvalUrl,
      purchaseId: purchase.id
    };
  } catch (error) {
    await prisma.starPurchase.delete({
      where: {
        id: purchase.id
      }
    });

    throw error;
  }
}

export async function completeStarsCheckout(userId: string, purchaseId: string, paypalOrderId: string) {
  if (!purchaseId || !paypalOrderId) {
    throw new Error("Missing PayPal stars checkout details.");
  }

  const purchase = await prisma.starPurchase.findFirst({
    where: {
      id: purchaseId,
      userId
    }
  });

  if (!purchase) {
    throw new Error("Stars purchase not found.");
  }

  if (purchase.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this stars purchase.");
  }

  if (purchase.status === "paid") {
    await notifyStarsPurchasePaid(purchase.id);

    return purchase;
  }

  if (purchase.status !== "pending") {
    throw new Error("This stars purchase can no longer be captured.");
  }

  const settings = await getPayPalSettings();
  const capture = await capturePayPalCheckoutOrder(paypalOrderId, settings);

  if (capture.status !== "COMPLETED") {
    throw new Error(`PayPal capture returned ${capture.status}.`);
  }

  if (capture.amountPence !== null && capture.amountPence !== purchase.totalPence) {
    throw new Error("PayPal captured amount did not match this stars purchase.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const purchaseUpdate = await tx.starPurchase.updateMany({
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

    if (purchaseUpdate.count !== 1) {
      throw new Error("This stars purchase was already processed.");
    }

    await tx.starWallet.upsert({
      where: {
        userId
      },
      update: {
        balance: {
          increment: purchase.stars
        }
      },
      create: {
        balance: purchase.stars,
        userId
      }
    });

    return tx.starPurchase.findUniqueOrThrow({
      where: {
        id: purchase.id
      }
    });
  });

  await writeAuditLog({
    actorId: userId,
    action: "stars.checkout.capture",
    target: `star-purchase:${updated.id}`,
    severity: "warning",
    metadata: {
      paypalCaptureId: updated.paypalCaptureId,
      paypalOrderId: updated.paypalOrderId,
      stars: updated.stars,
      totalPence: updated.totalPence
    }
  });

  await notifyStarsPurchasePaid(updated.id);

  return updated;
}

export async function cancelStarsCheckout(userId: string, purchaseId: string, paypalOrderId?: string) {
  if (!purchaseId) {
    throw new Error("Missing stars purchase.");
  }

  const purchase = await prisma.starPurchase.findFirst({
    where: {
      id: purchaseId,
      userId
    }
  });

  if (!purchase) {
    return null;
  }

  if (paypalOrderId && purchase.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this stars purchase.");
  }

  if (purchase.status !== "pending") {
    return purchase;
  }

  const updated = await prisma.starPurchase.update({
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
    action: "stars.checkout.cancel",
    target: `star-purchase:${updated.id}`,
    severity: "info",
    metadata: {
      paypalOrderId: updated.paypalOrderId,
      stars: updated.stars,
      totalPence: updated.totalPence
    }
  });

  return updated;
}
