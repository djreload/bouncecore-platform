import { formatMoney, notifyAccountUserOnce } from "@/lib/account/notification-email-service";
import { prisma } from "@/lib/db/prisma";

const producerVisiblePayoutStatuses = new Set(["blocked", "canceled", "denied", "failed", "onhold", "refunded", "returned", "success", "unclaimed"]);

type PayoutNotificationUser = {
  displayName: string;
  email: string;
  id: string;
};

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function statusLabel(status: string) {
  switch (status) {
    case "blocked":
      return "blocked";
    case "canceled":
      return "cancelled";
    case "denied":
      return "denied";
    case "failed":
      return "failed";
    case "onhold":
      return "on hold";
    case "refunded":
      return "refunded";
    case "returned":
      return "returned";
    case "success":
      return "paid";
    case "unclaimed":
      return "unclaimed";
    default:
      return status;
  }
}

function statusTitle(status: string) {
  return status === "success" ? "Producer payout paid" : `Producer payout ${statusLabel(status)}`;
}

function statusBody(status: string, amount: string, trackTitle: string) {
  if (status === "success") {
    return `${amount} producer payout for ${trackTitle} has completed through PayPal.`;
  }

  if (status === "unclaimed") {
    return `${amount} producer payout for ${trackTitle} is unclaimed in PayPal. Check the payout recipient account.`;
  }

  if (status === "onhold") {
    return `${amount} producer payout for ${trackTitle} is on hold in PayPal.`;
  }

  return `${amount} producer payout for ${trackTitle} is ${statusLabel(status)}.`;
}

async function loadPayoutItem(itemId: string) {
  return prisma.producerPayoutItem.findUnique({
    include: {
      batch: {
        select: {
          senderBatchId: true
        }
      },
      producer: {
        include: {
          user: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        }
      },
      purchase: {
        select: {
          trackTitle: true
        }
      }
    },
    where: {
      id: itemId
    }
  });
}

async function notifyProducer(user: PayoutNotificationUser, input: Omit<Parameters<typeof notifyAccountUserOnce>[0], "auditActionPrefix" | "user">) {
  await notifyAccountUserOnce({
    ...input,
    auditActionPrefix: "producer.payout",
    user
  });
}

export async function notifyProducerPayoutBatchQueued(batchId: string) {
  const items = await prisma.producerPayoutItem.findMany({
    include: {
      batch: {
        select: {
          senderBatchId: true
        }
      },
      producer: {
        include: {
          user: {
            select: {
              displayName: true,
              email: true,
              id: true
            }
          }
        }
      },
      purchase: {
        select: {
          trackTitle: true
        }
      }
    },
    where: {
      batchId
    }
  });
  const grouped = new Map<
    string,
    {
      amountPence: number;
      count: number;
      currency: string;
      recipientEmail: string;
      senderBatchId: string;
      tracks: string[];
      user: PayoutNotificationUser;
    }
  >();

  for (const item of items) {
    const existing = grouped.get(item.producerId);

    if (existing) {
      existing.amountPence += item.amountPence;
      existing.count += 1;
      existing.tracks.push(item.purchase.trackTitle);
      continue;
    }

    grouped.set(item.producerId, {
      amountPence: item.amountPence,
      count: 1,
      currency: item.currency,
      recipientEmail: item.recipientEmail,
      senderBatchId: item.batch.senderBatchId,
      tracks: [item.purchase.trackTitle],
      user: item.producer.user
    });
  }

  for (const [producerId, group] of grouped) {
    const amount = formatMoney(group.amountPence, group.currency);
    const trackSummary = group.tracks.slice(0, 4).join(", ");

    await notifyProducer(group.user, {
      body: `${amount} from ${plural(group.count, "sale")} has been queued for PayPal payout.`,
      dedupeKey: `producer-payout-batch-queued:${batchId}:${producerId}`,
      htmlLines: [
        `Hi ${group.user.displayName},`,
        `${amount} from ${plural(group.count, "music sale")} has been sent to PayPal Payouts.`,
        `Tracks: ${trackSummary}${group.tracks.length > 4 ? ", ..." : ""}`,
        `Recipient: ${group.recipientEmail}`,
        `Batch: ${group.senderBatchId}`
      ],
      subject: "Bouncecore producer payout queued",
      textLines: [
        `Hi ${group.user.displayName},`,
        "",
        `${amount} from ${plural(group.count, "music sale")} has been sent to PayPal Payouts.`,
        `Tracks: ${trackSummary}${group.tracks.length > 4 ? ", ..." : ""}`,
        `Recipient: ${group.recipientEmail}`,
        `Batch: ${group.senderBatchId}`
      ],
      title: "Producer payout queued",
      type: "producer.payout.queued"
    });
  }
}

export async function notifyProducerPayoutItemStatus(itemId: string, status: string) {
  if (!producerVisiblePayoutStatuses.has(status)) {
    return;
  }

  const item = await loadPayoutItem(itemId);

  if (!item) {
    return;
  }

  const amount = formatMoney(item.amountPence, item.currency);
  const title = statusTitle(status);
  const body = statusBody(status, amount, item.purchase.trackTitle);

  await notifyProducer(item.producer.user, {
    body,
    dedupeKey: `producer-payout-item:${item.id}:${status}`,
    htmlLines: [
      `Hi ${item.producer.user.displayName},`,
      body,
      `Track: ${item.purchase.trackTitle}`,
      `Recipient: ${item.recipientEmail}`,
      `Batch: ${item.batch.senderBatchId}`
    ],
    subject: `Bouncecore ${title.toLowerCase()}`,
    textLines: [
      `Hi ${item.producer.user.displayName},`,
      "",
      body,
      `Track: ${item.purchase.trackTitle}`,
      `Recipient: ${item.recipientEmail}`,
      `Batch: ${item.batch.senderBatchId}`
    ],
    title,
    type: `producer.payout.${status}`
  });
}

export async function notifyProducerPayoutItemStatusBySenderItemId(senderItemId: string, status: string) {
  const item = await prisma.producerPayoutItem.findUnique({
    select: {
      id: true
    },
    where: {
      senderItemId
    }
  });

  if (item) {
    await notifyProducerPayoutItemStatus(item.id, status);
  }
}

export async function notifyProducerPayoutItemsForBatchStatus(batchId: string, status: string) {
  const items = await prisma.producerPayoutItem.findMany({
    select: {
      id: true
    },
    where: {
      batchId
    }
  });

  for (const item of items) {
    await notifyProducerPayoutItemStatus(item.id, status);
  }
}
