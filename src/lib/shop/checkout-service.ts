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
const maxCheckoutItems = 30;

export type StartShopCheckoutInput = {
  origin: string;
  quantity: string;
  variantId: string;
};

export type ShopCheckoutItemInput = {
  quantity: string;
  variantId: string;
};

export type StartShopCartCheckoutInput = {
  items: ShopCheckoutItemInput[];
  origin: string;
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

type CheckoutVariant = {
  id: string;
  name: string;
  pricePence: number;
  product: {
    name: string;
    status: string;
  };
  sku: string;
  stock: number;
};

function normalizeCartItems(items: ShopCheckoutItemInput[]) {
  const merged = new Map<string, number>();

  items.forEach((item) => {
    const variantId = item.variantId.trim();

    if (!variantId) {
      return;
    }

    const quantity = checkoutQuantity(item.quantity || "1");
    merged.set(variantId, (merged.get(variantId) ?? 0) + quantity);
  });

  if (!merged.size) {
    throw new Error("Choose at least one product.");
  }

  if (merged.size > maxCheckoutItems) {
    throw new Error(`Shop basket checkout supports up to ${maxCheckoutItems} variants at a time.`);
  }

  return [...merged.entries()].map(([variantId, quantity]) => {
    if (quantity > maxCheckoutQuantity) {
      throw new Error(`Quantity must be between 1 and ${maxCheckoutQuantity}.`);
    }

    return {
      quantity,
      variantId
    };
  });
}

async function loadCheckoutVariants(items: ReturnType<typeof normalizeCartItems>) {
  const variants = await prisma.productVariant.findMany({
    where: {
      id: {
        in: items.map((item) => item.variantId)
      }
    },
    include: {
      product: true
    }
  });
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

  return items.map((item) => {
    const variant = variantsById.get(item.variantId);

    if (!variant || variant.product.status !== "active") {
      throw new Error("One or more products are not available for checkout.");
    }

    if (variant.stock < item.quantity) {
      throw new Error(`There is not enough stock for ${variant.sku}.`);
    }

    return {
      quantity: item.quantity,
      variant
    };
  });
}

function orderItemData(item: { quantity: number; variant: CheckoutVariant }) {
  const totalPence = item.variant.pricePence * item.quantity;

  return {
    productName: item.variant.product.name,
    productVariantId: item.variant.id,
    quantity: item.quantity,
    sku: item.variant.sku,
    totalPence,
    unitPricePence: item.variant.pricePence,
    variantName: item.variant.name
  };
}

function shopCheckoutDescription(items: { quantity: number; variant: CheckoutVariant }[]) {
  if (items.length === 1) {
    return payPalDescription(items[0].variant.product.name, items[0].variant.name);
  }

  return `${items.length} Bouncecore shop items`.slice(0, 120);
}

export async function startShopCartCheckout(userId: string, input: StartShopCartCheckoutInput): Promise<StartedShopCheckout> {
  const normalizedItems = normalizeCartItems(input.items);
  const [settings, checkoutItems] = await Promise.all([getPayPalSettings(), loadCheckoutVariants(normalizedItems)]);
  const readiness = getPayPalCheckoutReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal checkout is not ready.");
  }

  const lineItems = checkoutItems.map(orderItemData);
  const totalPence = lineItems.reduce((total, item) => total + item.totalPence, 0);
  const order = await prisma.order.create({
    data: {
      currency: checkoutCurrency,
      items: {
        create: lineItems
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
        description: shopCheckoutDescription(checkoutItems),
        items: checkoutItems.map((item) => ({
          name: payPalDescription(item.variant.product.name, item.variant.name),
          category: "PHYSICAL_GOODS",
          quantity: item.quantity,
          sku: item.variant.sku,
          unitAmountPence: item.variant.pricePence
        })),
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
        items: lineItems.map((item) => ({
          quantity: item.quantity,
          sku: item.sku,
          totalPence: item.totalPence
        })),
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

export async function startShopCheckout(userId: string, input: StartShopCheckoutInput): Promise<StartedShopCheckout> {
  return startShopCartCheckout(userId, {
    origin: input.origin,
    items: [
      {
        quantity: input.quantity,
        variantId: input.variantId
      }
    ]
  });
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
    const claim = await tx.order.updateMany({
      where: {
        id: order.id,
        status: "pending"
      },
      data: {
        status: "processing"
      }
    });

    if (claim.count !== 1) {
      throw new Error("This order was already processed.");
    }

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
