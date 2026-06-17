import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  notifyMusicCheckoutPaid,
  notifyMusicPurchasePaid,
  notifyShopOrderPaid,
  notifyStarsPurchasePaid
} from "@/lib/checkout/checkout-confirmation-service";
import { prisma } from "@/lib/db/prisma";
import { getPayPalSettings } from "@/lib/payments/paypal-service";
import {
  certUrlIsAllowedPayPalUrl,
  extractPayPalWebhookHeaders,
  verifyPayPalWebhookSignature,
  type PayPalWebhookSignatureHeaders
} from "@/lib/payments/paypal-webhook-signature";

const certificateCache = new Map<string, string>();
const maxWebhookBodyBytes = 1_000_000;

export type PayPalWebhookEventSummary = {
  createdAt: string;
  errorMessage: string | null;
  eventType: string;
  id: string;
  paypalEventId: string;
  processingStatus: string;
  resourceId: string | null;
  resourceType: string | null;
  transmissionId: string | null;
  verificationStatus: string;
};

type PayPalWebhookRecordInput = {
  event: Record<string, unknown>;
  headers: PayPalWebhookSignatureHeaders;
};

type PayPalCaptureDetails = {
  amountPence: number | null;
  captureId: string | null;
  currency: string | null;
  localIds: string[];
  paypalOrderId: string | null;
  payerEmail: string | null;
};

type ReconciliationResult = {
  action: string;
  target?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function penceValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function eventSummary(event: Record<string, unknown>) {
  const resource = asRecord(event.resource);
  const eventId = stringValue(event.id);

  if (!eventId) {
    throw new Error("PayPal webhook event ID is missing.");
  }

  return {
    eventType: stringValue(event.event_type) ?? "UNKNOWN",
    paypalEventId: eventId,
    resourceId: stringValue(resource.id),
    resourceType: stringValue(event.resource_type)
  };
}

function uniqueStrings(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function captureDetails(event: Record<string, unknown>): PayPalCaptureDetails {
  const resource = asRecord(event.resource);
  const amount = asRecord(resource.amount);
  const supplementaryData = asRecord(resource.supplementary_data);
  const relatedIds = asRecord(supplementaryData.related_ids);
  const payer = asRecord(resource.payer);

  return {
    amountPence: penceValue(amount.value),
    captureId: stringValue(resource.id),
    currency: stringValue(amount.currency_code),
    localIds: uniqueStrings([stringValue(resource.custom_id), stringValue(resource.invoice_id), stringValue(resource.reference_id)]),
    paypalOrderId: stringValue(relatedIds.order_id) ?? stringValue(resource.order_id),
    payerEmail: stringValue(payer.email_address)
  };
}

function payoutBatchStatus(eventType: string) {
  switch (eventType) {
    case "PAYMENT.PAYOUTSBATCH.DENIED":
      return "denied";
    case "PAYMENT.PAYOUTSBATCH.PROCESSING":
      return "processing";
    case "PAYMENT.PAYOUTSBATCH.SUCCESS":
      return "success";
    default:
      return null;
  }
}

function payoutItemStatus(eventType: string) {
  switch (eventType) {
    case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
      return "blocked";
    case "PAYMENT.PAYOUTS-ITEM.CANCELED":
      return "canceled";
    case "PAYMENT.PAYOUTS-ITEM.FAILED":
      return "failed";
    case "PAYMENT.PAYOUTS-ITEM.HELD":
      return "onhold";
    case "PAYMENT.PAYOUTS-ITEM.REFUNDED":
      return "refunded";
    case "PAYMENT.PAYOUTS-ITEM.RETURNED":
      return "returned";
    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
      return "success";
    case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED":
      return "unclaimed";
    default:
      return null;
  }
}

function requireMatchingAmount(actualPence: number | null, expectedPence: number, label: string) {
  if (actualPence !== null && actualPence !== expectedPence) {
    throw new Error(`PayPal webhook amount did not match ${label}.`);
  }
}

function requireMatchingCurrency(actualCurrency: string | null, expectedCurrency: string, label: string) {
  if (actualCurrency && actualCurrency !== expectedCurrency) {
    throw new Error(`PayPal webhook currency did not match ${label}.`);
  }
}

async function fetchPayPalCertificate(certUrl: string) {
  if (!certUrlIsAllowedPayPalUrl(certUrl)) {
    throw new Error("PayPal webhook certificate URL was not from an allowed PayPal host.");
  }

  const cached = certificateCache.get(certUrl);

  if (cached) {
    return cached;
  }

  const response = await fetch(certUrl, {
    headers: {
      Accept: "application/x-pem-file, text/plain, */*"
    }
  });

  if (!response.ok) {
    throw new Error(`PayPal webhook certificate download failed with ${response.status}.`);
  }

  const certificate = await response.text();

  if (!certificate.includes("BEGIN CERTIFICATE")) {
    throw new Error("PayPal webhook certificate response was not a PEM certificate.");
  }

  certificateCache.set(certUrl, certificate);

  return certificate;
}

async function verifyWebhookRequest(headers: PayPalWebhookSignatureHeaders, rawBody: string) {
  const settings = await getPayPalSettings();
  const certificatePem = await fetchPayPalCertificate(headers.certUrl);

  return verifyPayPalWebhookSignature(headers, settings.webhookId, rawBody, certificatePem);
}

async function findShopOrder(details: PayPalCaptureDetails) {
  if (details.paypalOrderId) {
    const order = await prisma.order.findUnique({
      include: {
        items: true
      },
      where: {
        paypalOrderId: details.paypalOrderId
      }
    });

    if (order) {
      return order;
    }
  }

  if (details.captureId) {
    const order = await prisma.order.findFirst({
      include: {
        items: true
      },
      where: {
        paypalCaptureId: details.captureId
      }
    });

    if (order) {
      return order;
    }
  }

  for (const id of details.localIds) {
    const order = await prisma.order.findUnique({
      include: {
        items: true
      },
      where: {
        id
      }
    });

    if (order) {
      return order;
    }
  }

  return null;
}

async function findTrackPurchase(details: PayPalCaptureDetails) {
  if (details.paypalOrderId) {
    const purchase = await prisma.digitalTrackPurchase.findUnique({
      where: {
        paypalOrderId: details.paypalOrderId
      }
    });

    if (purchase) {
      return purchase;
    }
  }

  if (details.captureId) {
    const purchase = await prisma.digitalTrackPurchase.findFirst({
      where: {
        paypalCaptureId: details.captureId
      }
    });

    if (purchase) {
      return purchase;
    }
  }

  for (const id of details.localIds) {
    const purchase = await prisma.digitalTrackPurchase.findUnique({
      where: {
        id
      }
    });

    if (purchase) {
      return purchase;
    }
  }

  return null;
}

async function findMusicCheckout(details: PayPalCaptureDetails) {
  if (details.paypalOrderId) {
    const checkout = await prisma.musicCheckout.findUnique({
      include: {
        purchases: true
      },
      where: {
        paypalOrderId: details.paypalOrderId
      }
    });

    if (checkout) {
      return checkout;
    }
  }

  if (details.captureId) {
    const checkout = await prisma.musicCheckout.findFirst({
      include: {
        purchases: true
      },
      where: {
        paypalCaptureId: details.captureId
      }
    });

    if (checkout) {
      return checkout;
    }
  }

  for (const id of details.localIds) {
    const checkout = await prisma.musicCheckout.findUnique({
      include: {
        purchases: true
      },
      where: {
        id
      }
    });

    if (checkout) {
      return checkout;
    }
  }

  return null;
}

async function findStarPurchase(details: PayPalCaptureDetails) {
  if (details.paypalOrderId) {
    const purchase = await prisma.starPurchase.findUnique({
      where: {
        paypalOrderId: details.paypalOrderId
      }
    });

    if (purchase) {
      return purchase;
    }
  }

  if (details.captureId) {
    const purchase = await prisma.starPurchase.findFirst({
      where: {
        paypalCaptureId: details.captureId
      }
    });

    if (purchase) {
      return purchase;
    }
  }

  for (const id of details.localIds) {
    const purchase = await prisma.starPurchase.findUnique({
      where: {
        id
      }
    });

    if (purchase) {
      return purchase;
    }
  }

  return null;
}

async function reconcileShopCapture(details: PayPalCaptureDetails): Promise<ReconciliationResult | null> {
  const order = await findShopOrder(details);

  if (!order) {
    return null;
  }

  if (["paid", "processing", "fulfilled"].includes(order.status)) {
    if (details.captureId && !order.paypalCaptureId) {
      await prisma.order.update({
        data: {
          paypalCaptureId: details.captureId,
          paypalPayerEmail: details.payerEmail
        },
        where: {
          id: order.id
        }
      });
    }

    await notifyShopOrderPaid(order.id);

    return {
      action: "shop-order-already-paid",
      target: `order:${order.id}`
    };
  }

  if (order.status !== "pending") {
    return {
      action: `shop-order-ignored-${order.status}`,
      target: `order:${order.id}`
    };
  }

  requireMatchingAmount(details.amountPence, order.totalPence, "shop order");
  requireMatchingCurrency(details.currency, order.currency, "shop order");

  await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      data: {
        status: "processing"
      },
      where: {
        id: order.id,
        status: "pending"
      }
    });

    if (claim.count !== 1) {
      throw new Error("This shop order was already processed.");
    }

    for (const item of order.items) {
      if (!item.productVariantId) {
        continue;
      }

      const stockUpdate = await tx.productVariant.updateMany({
        data: {
          stock: {
            decrement: item.quantity
          }
        },
        where: {
          id: item.productVariantId,
          stock: {
            gte: item.quantity
          }
        }
      });

      if (stockUpdate.count !== 1) {
        throw new Error(`Stock changed before webhook completion for ${item.sku}.`);
      }
    }

    await tx.order.update({
      data: {
        completedAt: new Date(),
        paypalCaptureId: details.captureId,
        paypalPayerEmail: details.payerEmail,
        status: "paid"
      },
      where: {
        id: order.id
      }
    });
  });

  await writeAuditLog({
    action: "payments.paypal.webhook.shop_capture",
    metadata: {
      paypalCaptureId: details.captureId,
      paypalOrderId: order.paypalOrderId,
      totalPence: order.totalPence
    },
    severity: "warning",
    target: `order:${order.id}`
  });

  await notifyShopOrderPaid(order.id);

  return {
    action: "shop-order-paid",
    target: `order:${order.id}`
  };
}

async function reconcileMusicCheckoutCapture(details: PayPalCaptureDetails): Promise<ReconciliationResult | null> {
  const checkout = await findMusicCheckout(details);

  if (!checkout) {
    return null;
  }

  if (checkout.status === "paid") {
    if (details.captureId && !checkout.paypalCaptureId) {
      await prisma.musicCheckout.update({
        data: {
          paypalCaptureId: details.captureId,
          paypalPayerEmail: details.payerEmail
        },
        where: {
          id: checkout.id
        }
      });
    }

    await notifyMusicCheckoutPaid(checkout.id);

    return {
      action: "music-checkout-already-paid",
      target: `music-checkout:${checkout.id}`
    };
  }

  if (checkout.status !== "pending") {
    return {
      action: `music-checkout-ignored-${checkout.status}`,
      target: `music-checkout:${checkout.id}`
    };
  }

  requireMatchingAmount(details.amountPence, checkout.totalPence, "music basket checkout");
  requireMatchingCurrency(details.currency, checkout.currency, "music basket checkout");

  await prisma.$transaction(async (tx) => {
    const update = await tx.musicCheckout.updateMany({
      data: {
        completedAt: new Date(),
        paypalCaptureId: details.captureId,
        paypalPayerEmail: details.payerEmail,
        status: "paid"
      },
      where: {
        id: checkout.id,
        status: "pending"
      }
    });

    if (update.count !== 1) {
      throw new Error("This music basket checkout was already processed.");
    }

    await tx.digitalTrackPurchase.updateMany({
      data: {
        completedAt: new Date(),
        paypalCaptureId: details.captureId,
        paypalPayerEmail: details.payerEmail,
        status: "paid"
      },
      where: {
        checkoutId: checkout.id,
        status: "pending"
      }
    });
  });

  await writeAuditLog({
    action: "payments.paypal.webhook.music_cart_capture",
    metadata: {
      paypalCaptureId: details.captureId,
      paypalOrderId: checkout.paypalOrderId,
      purchaseIds: checkout.purchases.map((purchase) => purchase.id),
      totalPence: checkout.totalPence,
      trackIds: checkout.purchases.map((purchase) => purchase.trackId)
    },
    severity: "warning",
    target: `music-checkout:${checkout.id}`
  });

  await notifyMusicCheckoutPaid(checkout.id);

  return {
    action: "music-checkout-paid",
    target: `music-checkout:${checkout.id}`
  };
}

async function reconcileTrackCapture(details: PayPalCaptureDetails): Promise<ReconciliationResult | null> {
  const purchase = await findTrackPurchase(details);

  if (!purchase) {
    return null;
  }

  if (purchase.status === "paid") {
    if (details.captureId && !purchase.paypalCaptureId) {
      await prisma.digitalTrackPurchase.update({
        data: {
          paypalCaptureId: details.captureId,
          paypalPayerEmail: details.payerEmail
        },
        where: {
          id: purchase.id
        }
      });
    }

    await notifyMusicPurchasePaid(purchase.id);

    return {
      action: "track-purchase-already-paid",
      target: `track-purchase:${purchase.id}`
    };
  }

  if (purchase.status !== "pending") {
    return {
      action: `track-purchase-ignored-${purchase.status}`,
      target: `track-purchase:${purchase.id}`
    };
  }

  requireMatchingAmount(details.amountPence, purchase.pricePence, "music purchase");
  requireMatchingCurrency(details.currency, purchase.currency, "music purchase");

  const update = await prisma.digitalTrackPurchase.updateMany({
    data: {
      completedAt: new Date(),
      paypalCaptureId: details.captureId,
      paypalPayerEmail: details.payerEmail,
      status: "paid"
    },
    where: {
      id: purchase.id,
      status: "pending"
    }
  });

  if (update.count !== 1) {
    throw new Error("This music purchase was already processed.");
  }

  await writeAuditLog({
    action: "payments.paypal.webhook.music_capture",
    metadata: {
      paypalCaptureId: details.captureId,
      paypalOrderId: purchase.paypalOrderId,
      producerEarningsPence: purchase.producerEarningsPence,
      totalPence: purchase.pricePence,
      trackId: purchase.trackId
    },
    severity: "warning",
    target: `track-purchase:${purchase.id}`
  });

  await notifyMusicPurchasePaid(purchase.id);

  return {
    action: "track-purchase-paid",
    target: `track-purchase:${purchase.id}`
  };
}

async function reconcileStarsCapture(details: PayPalCaptureDetails): Promise<ReconciliationResult | null> {
  const purchase = await findStarPurchase(details);

  if (!purchase) {
    return null;
  }

  if (purchase.status === "paid") {
    if (details.captureId && !purchase.paypalCaptureId) {
      await prisma.starPurchase.update({
        data: {
          paypalCaptureId: details.captureId,
          paypalPayerEmail: details.payerEmail
        },
        where: {
          id: purchase.id
        }
      });
    }

    await notifyStarsPurchasePaid(purchase.id);

    return {
      action: "stars-purchase-already-paid",
      target: `star-purchase:${purchase.id}`
    };
  }

  if (purchase.status !== "pending") {
    return {
      action: `stars-purchase-ignored-${purchase.status}`,
      target: `star-purchase:${purchase.id}`
    };
  }

  requireMatchingAmount(details.amountPence, purchase.totalPence, "stars purchase");
  requireMatchingCurrency(details.currency, purchase.currency, "stars purchase");

  await prisma.$transaction(async (tx) => {
    const update = await tx.starPurchase.updateMany({
      data: {
        completedAt: new Date(),
        paypalCaptureId: details.captureId,
        paypalPayerEmail: details.payerEmail,
        status: "paid"
      },
      where: {
        id: purchase.id,
        status: "pending"
      }
    });

    if (update.count !== 1) {
      throw new Error("This stars purchase was already processed.");
    }

    await tx.starWallet.upsert({
      create: {
        balance: purchase.stars,
        userId: purchase.userId
      },
      update: {
        balance: {
          increment: purchase.stars
        }
      },
      where: {
        userId: purchase.userId
      }
    });
  });

  await writeAuditLog({
    action: "payments.paypal.webhook.stars_capture",
    metadata: {
      paypalCaptureId: details.captureId,
      paypalOrderId: purchase.paypalOrderId,
      stars: purchase.stars,
      totalPence: purchase.totalPence
    },
    severity: "warning",
    target: `star-purchase:${purchase.id}`
  });

  await notifyStarsPurchasePaid(purchase.id);

  return {
    action: "stars-purchase-paid",
    target: `star-purchase:${purchase.id}`
  };
}

async function reconcileCaptureCompleted(event: Record<string, unknown>) {
  const details = captureDetails(event);

  if (!details.captureId && !details.paypalOrderId && !details.localIds.length) {
    return {
      action: "capture-completed-unmatched"
    };
  }

  return (
    (await reconcileShopCapture(details)) ??
    (await reconcileMusicCheckoutCapture(details)) ??
    (await reconcileTrackCapture(details)) ??
    (await reconcileStarsCapture(details)) ?? {
      action: "capture-completed-unmatched"
    }
  );
}

async function reconcilePayoutBatchEvent(eventType: string, event: Record<string, unknown>) {
  const status = payoutBatchStatus(eventType);
  const resource = asRecord(event.resource);
  const batchHeader = asRecord(resource.batch_header);
  const batchId = stringValue(resource.payout_batch_id) ?? stringValue(batchHeader.payout_batch_id) ?? stringValue(resource.id);

  if (!status || !batchId) {
    return {
      action: "payout-batch-ignored"
    };
  }

  const update = await prisma.producerPayoutBatch.updateMany({
    data: {
      paypalBatchStatus: status,
      paypalResponse: jsonValue(event.resource),
      status,
      syncedAt: new Date()
    },
    where: {
      paypalPayoutBatchId: batchId
    }
  });

  return {
    action: update.count ? "payout-batch-updated" : "payout-batch-unmatched",
    target: update.count ? `paypal-payout-batch:${batchId}` : undefined
  };
}

async function reconcilePayoutItemEvent(eventType: string, event: Record<string, unknown>) {
  const status = payoutItemStatus(eventType);
  const resource = asRecord(event.resource);
  const payoutItem = asRecord(resource.payout_item);
  const senderItemId = stringValue(payoutItem.sender_item_id) ?? stringValue(resource.sender_item_id);
  const payoutItemId = stringValue(resource.payout_item_id) ?? stringValue(resource.id);
  const transactionId = stringValue(resource.transaction_id);

  if (!status || (!senderItemId && !payoutItemId)) {
    return {
      action: "payout-item-ignored"
    };
  }

  const data: Prisma.ProducerPayoutItemUpdateManyMutationInput = {
    paypalTransactionId: transactionId,
    paypalTransactionStatus: status,
    status
  };

  if (payoutItemId) {
    data.paypalPayoutItemId = payoutItemId;
  }

  const update = await prisma.producerPayoutItem.updateMany({
    data,
    where: senderItemId
      ? {
          senderItemId
        }
      : {
          paypalPayoutItemId: payoutItemId
        }
  });

  return {
    action: update.count ? "payout-item-updated" : "payout-item-unmatched",
    target: senderItemId ? `producer-payout-item:${senderItemId}` : payoutItemId ? `paypal-payout-item:${payoutItemId}` : undefined
  };
}

async function reconcilePayPalWebhookEvent(event: Record<string, unknown>): Promise<ReconciliationResult> {
  const eventType = stringValue(event.event_type) ?? "";

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    return reconcileCaptureCompleted(event);
  }

  if (eventType.startsWith("PAYMENT.PAYOUTSBATCH.")) {
    return reconcilePayoutBatchEvent(eventType, event);
  }

  if (eventType.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    return reconcilePayoutItemEvent(eventType, event);
  }

  return {
    action: "recorded"
  };
}

async function recordPayPalWebhookEvent({ event, headers }: PayPalWebhookRecordInput) {
  const summary = eventSummary(event);
  const existing = await prisma.payPalWebhookEvent.findUnique({
    where: {
      paypalEventId: summary.paypalEventId
    }
  });

  if (existing) {
    return {
      eventId: existing.id,
      processingStatus: "duplicate" as const
    };
  }

  const created = await prisma.payPalWebhookEvent.create({
    data: {
      eventType: summary.eventType,
      payload: jsonValue(event),
      paypalEventId: summary.paypalEventId,
      processingStatus: "received",
      resourceId: summary.resourceId,
      resourceType: summary.resourceType,
      transmissionId: headers.transmissionId,
      verificationStatus: "verified"
    }
  });

  let reconciliation: ReconciliationResult;

  try {
    reconciliation = await reconcilePayPalWebhookEvent(event);

    await prisma.payPalWebhookEvent.update({
      data: {
        processedAt: new Date(),
        processingStatus: reconciliation.action
      },
      where: {
        id: created.id
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "PayPal webhook reconciliation failed.";

    reconciliation = {
      action: "failed"
    };

    await prisma.payPalWebhookEvent.update({
      data: {
        errorMessage,
        processedAt: new Date(),
        processingStatus: "failed"
      },
      where: {
        id: created.id
      }
    });

    await writeAuditLog({
      action: "payments.paypal.webhook.failed",
      metadata: {
        errorMessage,
        eventType: created.eventType,
        paypalEventId: created.paypalEventId,
        transmissionId: created.transmissionId
      },
      severity: "critical",
      target: `paypal-webhook:${created.paypalEventId}`
    });
  }

  await writeAuditLog({
    action: "payments.paypal.webhook.received",
    metadata: {
      action: reconciliation.action,
      eventType: created.eventType,
      paypalEventId: created.paypalEventId,
      processingStatus: reconciliation.action,
      resourceId: created.resourceId,
      resourceType: created.resourceType,
      target: reconciliation.target,
      transmissionId: created.transmissionId
    },
    severity: "info",
    target: `paypal-webhook:${created.paypalEventId}`
  });

  return {
    eventId: created.id,
    processingStatus: reconciliation.action
  };
}

export async function ingestPayPalWebhook(request: Request) {
  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > maxWebhookBodyBytes) {
    throw new Error("PayPal webhook payload is too large.");
  }

  const headers = extractPayPalWebhookHeaders(request.headers);
  const parsed = JSON.parse(rawBody) as unknown;
  const event = asRecord(parsed);
  const verified = await verifyWebhookRequest(headers, rawBody);

  if (!verified) {
    throw new Error("PayPal webhook signature verification failed.");
  }

  return recordPayPalWebhookEvent({
    event,
    headers
  });
}

export async function getRecentPayPalWebhookEvents(limit = 8): Promise<PayPalWebhookEventSummary[]> {
  const events = await prisma.payPalWebhookEvent.findMany({
    orderBy: {
      receivedAt: "desc"
    },
    select: {
      errorMessage: true,
      eventType: true,
      id: true,
      paypalEventId: true,
      processingStatus: true,
      receivedAt: true,
      resourceId: true,
      resourceType: true,
      transmissionId: true,
      verificationStatus: true
    },
    take: limit
  });

  return events.map((event) => ({
    createdAt: event.receivedAt.toISOString(),
    errorMessage: event.errorMessage,
    eventType: event.eventType,
    id: event.id,
    paypalEventId: event.paypalEventId,
    processingStatus: event.processingStatus,
    resourceId: event.resourceId,
    resourceType: event.resourceType,
    transmissionId: event.transmissionId,
    verificationStatus: event.verificationStatus
  }));
}
