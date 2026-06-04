import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import {
  createPayPalPayoutBatch,
  getPayPalPayoutBatchDetails,
  getPayPalPayoutReadiness,
  getPayPalSettings,
  PayPalApiError
} from "@/lib/payments/paypal-service";

const activePayoutStatuses = ["pending", "processing", "success", "unclaimed", "onhold"] as const;
const defaultCurrency = "GBP";
const payoutBatchLimit = 500;

type EligiblePayoutPurchase = Awaited<ReturnType<typeof loadEligiblePayoutPurchases>>[number];

export type ProducerPayoutRecipientRow = {
  amountPence: number;
  paypalPayoutEmail: string;
  producerId: string;
  producerName: string;
  producerSlug: string;
  saleCount: number;
};

export type ProducerPayoutSaleRow = {
  amountPence: number;
  completedAt: string | null;
  id: string;
  paypalPayoutEmail: string;
  producerName: string;
  trackTitle: string;
};

export type ProducerPayoutBatchItemRow = {
  amountPence: number;
  errorMessage: string | null;
  id: string;
  paypalPayoutItemId: string | null;
  producerName: string;
  recipientEmail: string;
  status: string;
  trackTitle: string;
};

export type ProducerPayoutBatchRow = {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  itemCount: number;
  items: ProducerPayoutBatchItemRow[];
  paypalBatchStatus: string | null;
  paypalPayoutBatchId: string | null;
  senderBatchId: string;
  sentAt: string | null;
  status: string;
  syncedAt: string | null;
  totalPence: number;
};

export type AdminProducerPayoutsData = {
  eligibleRecipients: ProducerPayoutRecipientRow[];
  eligibleSales: ProducerPayoutSaleRow[];
  missingRecipientCount: number;
  recentBatches: ProducerPayoutBatchRow[];
  readiness: {
    ready: boolean;
    reason: string | null;
  };
  stats: {
    eligibleItemCount: number;
    eligiblePence: number;
    missingRecipientPence: number;
  };
};

function payoutStatusIsActive(status: string) {
  return activePayoutStatuses.includes(status as (typeof activePayoutStatuses)[number]);
}

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeBatchStatus(status: string) {
  if (!status || status === "unknown") {
    return "pending";
  }

  return status;
}

function payoutApiErrorMessage(error: unknown) {
  if (error instanceof PayPalApiError) {
    return [error.message, error.detail].filter(Boolean).join(" ");
  }

  return error instanceof Error ? error.message : "PayPal payout request failed.";
}

function senderBatchId() {
  return `bouncecore-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function senderItemId(purchaseId: string) {
  return `bc-${purchaseId.slice(-10)}-${randomUUID().slice(0, 8)}`;
}

async function loadEligiblePayoutPurchases(limit = payoutBatchLimit) {
  const purchases = await prisma.digitalTrackPurchase.findMany({
    where: {
      currency: defaultCurrency,
      payoutItems: {
        none: {
          status: {
            in: [...activePayoutStatuses]
          }
        }
      },
      producer: {
        paypalPayoutEmail: {
          not: null
        }
      },
      producerEarningsPence: {
        gt: 0
      },
      status: "paid"
    },
    include: {
      producer: {
        select: {
          id: true,
          name: true,
          paypalPayoutEmail: true,
          slug: true
        }
      }
    },
    orderBy: [
      {
        completedAt: "asc"
      },
      {
        createdAt: "asc"
      }
    ],
    take: limit
  });

  return purchases.filter((purchase) => normalizedEmail(purchase.producer.paypalPayoutEmail));
}

async function loadMissingRecipientSummary() {
  const purchases = await prisma.digitalTrackPurchase.findMany({
    where: {
      currency: defaultCurrency,
      payoutItems: {
        none: {
          status: {
            in: [...activePayoutStatuses]
          }
        }
      },
      producerEarningsPence: {
        gt: 0
      },
      status: "paid"
    },
    include: {
      producer: {
        select: {
          paypalPayoutEmail: true
        }
      }
    }
  });
  const missing = purchases.filter((purchase) => !normalizedEmail(purchase.producer.paypalPayoutEmail));

  return {
    count: missing.length,
    totalPence: missing.reduce((total, purchase) => total + purchase.producerEarningsPence, 0)
  };
}

function groupEligibleRecipients(purchases: EligiblePayoutPurchase[]): ProducerPayoutRecipientRow[] {
  const recipients = new Map<string, ProducerPayoutRecipientRow>();

  for (const purchase of purchases) {
    const paypalPayoutEmail = normalizedEmail(purchase.producer.paypalPayoutEmail);
    const key = `${purchase.producerId}:${paypalPayoutEmail}`;
    const existing = recipients.get(key);

    if (existing) {
      existing.amountPence += purchase.producerEarningsPence;
      existing.saleCount += 1;
      continue;
    }

    recipients.set(key, {
      amountPence: purchase.producerEarningsPence,
      paypalPayoutEmail,
      producerId: purchase.producerId,
      producerName: purchase.producer.name,
      producerSlug: purchase.producer.slug,
      saleCount: 1
    });
  }

  return [...recipients.values()].sort((first, second) => second.amountPence - first.amountPence);
}

function saleRow(purchase: EligiblePayoutPurchase): ProducerPayoutSaleRow {
  return {
    amountPence: purchase.producerEarningsPence,
    completedAt: purchase.completedAt?.toISOString() ?? null,
    id: purchase.id,
    paypalPayoutEmail: normalizedEmail(purchase.producer.paypalPayoutEmail),
    producerName: purchase.producer.name,
    trackTitle: purchase.trackTitle
  };
}

function batchRow(batch: {
  createdAt: Date;
  errorMessage: string | null;
  id: string;
  itemCount: number;
  items: {
    amountPence: number;
    errorMessage: string | null;
    id: string;
    paypalPayoutItemId: string | null;
    recipientEmail: string;
    status: string;
    producer: {
      name: string;
    };
    purchase: {
      trackTitle: string;
    };
  }[];
  paypalBatchStatus: string | null;
  paypalPayoutBatchId: string | null;
  senderBatchId: string;
  sentAt: Date | null;
  status: string;
  syncedAt: Date | null;
  totalPence: number;
}): ProducerPayoutBatchRow {
  return {
    createdAt: batch.createdAt.toISOString(),
    errorMessage: batch.errorMessage,
    id: batch.id,
    itemCount: batch.itemCount,
    items: batch.items.map((item) => ({
      amountPence: item.amountPence,
      errorMessage: item.errorMessage,
      id: item.id,
      paypalPayoutItemId: item.paypalPayoutItemId,
      producerName: item.producer.name,
      recipientEmail: item.recipientEmail,
      status: item.status,
      trackTitle: item.purchase.trackTitle
    })),
    paypalBatchStatus: batch.paypalBatchStatus,
    paypalPayoutBatchId: batch.paypalPayoutBatchId,
    senderBatchId: batch.senderBatchId,
    sentAt: batch.sentAt?.toISOString() ?? null,
    status: batch.status,
    syncedAt: batch.syncedAt?.toISOString() ?? null,
    totalPence: batch.totalPence
  };
}

async function loadRecentPayoutBatches() {
  const batches = await prisma.producerPayoutBatch.findMany({
    include: {
      items: {
        include: {
          producer: {
            select: {
              name: true
            }
          },
          purchase: {
            select: {
              trackTitle: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        },
        take: 8
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 8
  });

  return batches.map(batchRow);
}

export async function getAdminProducerPayoutsData(): Promise<AdminProducerPayoutsData> {
  const [settings, eligiblePurchases, missingRecipientSummary, recentBatches] = await Promise.all([
    getPayPalSettings(),
    loadEligiblePayoutPurchases(),
    loadMissingRecipientSummary(),
    loadRecentPayoutBatches()
  ]);
  const readiness = getPayPalPayoutReadiness(settings);

  return {
    eligibleRecipients: groupEligibleRecipients(eligiblePurchases),
    eligibleSales: eligiblePurchases.slice(0, 12).map(saleRow),
    missingRecipientCount: missingRecipientSummary.count,
    readiness,
    recentBatches,
    stats: {
      eligibleItemCount: eligiblePurchases.length,
      eligiblePence: eligiblePurchases.reduce((total, purchase) => total + purchase.producerEarningsPence, 0),
      missingRecipientPence: missingRecipientSummary.totalPence
    }
  };
}

export async function createProducerPayoutBatch(actorId: string) {
  const settings = await getPayPalSettings();
  const readiness = getPayPalPayoutReadiness(settings);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? "PayPal producer payouts are not ready.");
  }

  const purchases = await loadEligiblePayoutPurchases();

  if (!purchases.length) {
    throw new Error("There are no eligible paid producer sales with PayPal payout emails.");
  }

  const batchSenderId = senderBatchId();
  const totalPence = purchases.reduce((total, purchase) => total + purchase.producerEarningsPence, 0);
  const batch = await prisma.producerPayoutBatch.create({
    data: {
      currency: defaultCurrency,
      itemCount: purchases.length,
      requestedById: actorId,
      senderBatchId: batchSenderId,
      status: "pending",
      totalPence,
      items: {
        create: purchases.map((purchase) => ({
          amountPence: purchase.producerEarningsPence,
          currency: purchase.currency,
          producerId: purchase.producerId,
          purchaseId: purchase.id,
          recipientEmail: normalizedEmail(purchase.producer.paypalPayoutEmail),
          senderItemId: senderItemId(purchase.id),
          status: "pending"
        }))
      }
    },
    include: {
      items: true
    }
  });

  try {
    const paypalBatch = await createPayPalPayoutBatch(
      {
        emailMessage: "Your Bouncecore producer earnings payout has been sent.",
        emailSubject: "Bouncecore producer payout",
        items: batch.items.map((item) => ({
          amountPence: item.amountPence,
          currencyCode: item.currency,
          note: "Bouncecore music sale earnings",
          receiver: item.recipientEmail,
          recipientType: "EMAIL",
          senderItemId: item.senderItemId
        })),
        senderBatchId: batch.senderBatchId
      },
      settings
    );
    const status = normalizeBatchStatus(paypalBatch.batchStatus);

    const updated = await prisma.producerPayoutBatch.update({
      where: {
        id: batch.id
      },
      data: {
        paypalBatchStatus: paypalBatch.batchStatus,
        paypalPayoutBatchId: paypalBatch.paypalPayoutBatchId,
        paypalResponse: jsonValue(paypalBatch.raw),
        sentAt: new Date(),
        status
      }
    });

    await writeAuditLog({
      actorId,
      action: "payments.paypal.producer_payout.create",
      target: `producer-payout-batch:${updated.id}`,
      severity: "critical",
      metadata: {
        itemCount: updated.itemCount,
        paypalPayoutBatchId: updated.paypalPayoutBatchId,
        senderBatchId: updated.senderBatchId,
        totalPence: updated.totalPence
      }
    });

    return updated;
  } catch (error) {
    const errorMessage = payoutApiErrorMessage(error);

    const failed = await prisma.producerPayoutBatch.update({
      where: {
        id: batch.id
      },
      data: {
        errorMessage,
        status: "failed",
        items: {
          updateMany: {
            data: {
              errorMessage,
              status: "failed"
            },
            where: {}
          }
        }
      }
    });

    await writeAuditLog({
      actorId,
      action: "payments.paypal.producer_payout.failed",
      target: `producer-payout-batch:${failed.id}`,
      severity: "critical",
      metadata: {
        errorMessage,
        senderBatchId: failed.senderBatchId,
        totalPence: failed.totalPence
      }
    });

    throw new Error(errorMessage);
  }
}

export async function syncProducerPayoutBatch(actorId: string, batchId: string) {
  const batch = await prisma.producerPayoutBatch.findUniqueOrThrow({
    where: {
      id: batchId
    },
    include: {
      items: true
    }
  });

  if (!batch.paypalPayoutBatchId) {
    throw new Error("This payout batch has not been accepted by PayPal yet.");
  }

  const settings = await getPayPalSettings();
  const details = await getPayPalPayoutBatchDetails(batch.paypalPayoutBatchId, settings);
  const nextBatchStatus = normalizeBatchStatus(details.batchStatus);

  await prisma.$transaction(async (tx) => {
    await tx.producerPayoutBatch.update({
      where: {
        id: batch.id
      },
      data: {
        paypalBatchStatus: details.batchStatus,
        paypalResponse: jsonValue(details.raw),
        status: nextBatchStatus,
        syncedAt: new Date()
      }
    });

    for (const item of details.items) {
      await tx.producerPayoutItem.updateMany({
        where: {
          batchId: batch.id,
          senderItemId: item.senderItemId
        },
        data: {
          errorMessage: item.errorMessage,
          paypalFeePence: item.paypalFeePence,
          paypalPayoutItemId: item.paypalPayoutItemId,
          paypalTransactionId: item.paypalTransactionId,
          paypalTransactionStatus: item.transactionStatus,
          status: item.transactionStatus
        }
      });
    }

    if ((nextBatchStatus === "denied" || nextBatchStatus === "canceled") && !details.items.length) {
      await tx.producerPayoutItem.updateMany({
        where: {
          batchId: batch.id,
          status: {
            in: [...activePayoutStatuses]
          }
        },
        data: {
          status: nextBatchStatus
        }
      });
    }
  });

  await writeAuditLog({
    actorId,
    action: "payments.paypal.producer_payout.sync",
    target: `producer-payout-batch:${batch.id}`,
    severity: nextBatchStatus === "success" ? "warning" : "info",
    metadata: {
      paypalPayoutBatchId: batch.paypalPayoutBatchId,
      status: nextBatchStatus
    }
  });

  return prisma.producerPayoutBatch.findUniqueOrThrow({
    where: {
      id: batch.id
    }
  });
}

export function producerSaleIsPayable(payoutStatus: string | null) {
  return !payoutStatus || !payoutStatusIsActive(payoutStatus);
}
