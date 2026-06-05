import { writeAuditLog } from "@/lib/auth/audit";
import {
  capturePayPalCheckoutOrder,
  createPayPalCheckoutOrder,
  getPayPalCheckoutReadiness,
  getPayPalSettings
} from "@/lib/payments/paypal-service";
import { prisma } from "@/lib/db/prisma";

const checkoutCurrency = "GBP";
const maxCheckoutQuantity = 10;

export type StartShopCheckoutInput = {
  origin: string;
  quantity: string;
  variantId: string;
};

export type StartedShopCheckout = {
  approvalUrl: string;
  orderId: string;
};

function checkoutQuantity(value: string) {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxCheckoutQuantity) {
    throw new Error(`Quantity must be between 1 and ${maxCheckoutQuantity}.`);
  }

  return quantity;
}

function checkoutUrl(origin: string, path: string, params: Record<string, string>) {
  const url = new URL(path, origin);

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  return url.toString();
}

function payPalDescription(productName: string, variantName: string) {
  return `${productName} - ${variantName}`.slice(0, 120);
}

async function loadCheckoutVariant(variantId: string) {
  if (!variantId) {
    throw new Error("Choose a product variant.");
  }

  const variant = await prisma.productVariant.findUnique({
    where: {
      id: variantId
    },
    include: {
      product: true
    }
  });

  if (!variant || variant.product.status !== "active") {
    throw new Error("That product is not available for checkout.");
  }

  return variant;
}

export async function startShopCheckout(userId: string, input: StartShopCheckoutInput): Promise<StartedShopCheckout> {
  const [settings, variant] = await Promise.all([getPayPalSettings(), loadCheckoutVariant(input.variantId)]);
  const readiness = getPayPalCheckoutReadiness(settings);
  const quantity = checkoutQuantity(input.quantity);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal checkout is not ready.");
  }

  if (variant.stock < quantity) {
    throw new Error("There is not enough stock for that quantity.");
  }

  const totalPence = variant.pricePence * quantity;
  const order = await prisma.order.create({
    data: {
      currency: checkoutCurrency,
      items: {
        create: [
          {
            productName: variant.product.name,
            productVariantId: variant.id,
            quantity,
            sku: variant.sku,
            totalPence,
            unitPricePence: variant.pricePence,
            variantName: variant.name
          }
        ]
      },
      status: "pending",
      totalPence,
      userId
    }
  });

  try {
    const paypal = await createPayPalCheckoutOrder(
      {
        cancelUrl: checkoutUrl(input.origin, "/shop/checkout/cancel", {
          orderId: order.id
        }),
        currencyCode: checkoutCurrency,
        description: payPalDescription(variant.product.name, variant.name),
        items: [
          {
            name: payPalDescription(variant.product.name, variant.name),
            category: "PHYSICAL_GOODS",
            quantity,
            sku: variant.sku,
            unitAmountPence: variant.pricePence
          }
        ],
        localOrderId: order.id,
        returnUrl: checkoutUrl(input.origin, "/shop/checkout/return", {
          orderId: order.id
        }),
        totalPence
      },
      settings
    );

    await prisma.order.update({
      where: {
        id: order.id
      },
      data: {
        paypalOrderId: paypal.paypalOrderId
      }
    });

    await writeAuditLog({
      actorId: userId,
      action: "shop.checkout.start",
      target: `order:${order.id}`,
      severity: "info",
      metadata: {
        paypalOrderId: paypal.paypalOrderId,
        quantity,
        sku: variant.sku,
        totalPence
      }
    });

    return {
      approvalUrl: paypal.approvalUrl,
      orderId: order.id
    };
  } catch (error) {
    await prisma.order.delete({
      where: {
        id: order.id
      }
    });

    throw error;
  }
}

export async function completeShopCheckout(userId: string, orderId: string, paypalOrderId: string) {
  if (!orderId || !paypalOrderId) {
    throw new Error("Missing PayPal checkout details.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId
    },
    include: {
      items: true
    }
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this checkout.");
  }

  if (["paid", "processing", "fulfilled"].includes(order.status)) {
    return order;
  }

  if (order.status !== "pending") {
    throw new Error("This order can no longer be captured.");
  }

  for (const item of order.items) {
    if (!item.productVariantId) {
      continue;
    }

    const variant = await prisma.productVariant.findUnique({
      where: {
        id: item.productVariantId
      },
      select: {
        stock: true
      }
    });

    if (!variant || variant.stock < item.quantity) {
      throw new Error(`Stock changed before checkout completed for ${item.sku}.`);
    }
  }

  const settings = await getPayPalSettings();
  const capture = await capturePayPalCheckoutOrder(paypalOrderId, settings);

  if (capture.status !== "COMPLETED") {
    throw new Error(`PayPal capture returned ${capture.status}.`);
  }

  if (capture.amountPence !== null && capture.amountPence !== order.totalPence) {
    throw new Error("PayPal captured amount did not match this order.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.productVariantId) {
        continue;
      }

      const stockUpdate = await tx.productVariant.updateMany({
        where: {
          id: item.productVariantId,
          stock: {
            gte: item.quantity
          }
        },
        data: {
          stock: {
            decrement: item.quantity
          }
        }
      });

      if (stockUpdate.count !== 1) {
        throw new Error(`Stock changed before checkout completed for ${item.sku}.`);
      }
    }

    return tx.order.update({
      where: {
        id: order.id
      },
      data: {
        completedAt: new Date(),
        paypalCaptureId: capture.captureId,
        paypalPayerEmail: capture.payerEmail,
        status: "paid"
      }
    });
  });

  await writeAuditLog({
    actorId: userId,
    action: "shop.checkout.capture",
    target: `order:${updated.id}`,
    severity: "warning",
    metadata: {
      paypalCaptureId: updated.paypalCaptureId,
      paypalOrderId: updated.paypalOrderId,
      totalPence: updated.totalPence
    }
  });

  return updated;
}

export async function cancelShopCheckout(userId: string, orderId: string, paypalOrderId?: string) {
  if (!orderId) {
    throw new Error("Missing order.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId
    }
  });

  if (!order) {
    return null;
  }

  if (paypalOrderId && order.paypalOrderId !== paypalOrderId) {
    throw new Error("PayPal order did not match this checkout.");
  }

  if (order.status !== "pending") {
    return order;
  }

  const updated = await prisma.order.update({
    where: {
      id: order.id
    },
    data: {
      cancelledAt: new Date(),
      status: "cancelled"
    }
  });

  await writeAuditLog({
    actorId: userId,
    action: "shop.checkout.cancel",
    target: `order:${updated.id}`,
    severity: "info",
    metadata: {
      paypalOrderId: updated.paypalOrderId,
      totalPence: updated.totalPence
    }
  });

  return updated;
}
