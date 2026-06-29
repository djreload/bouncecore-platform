import { prisma } from "@/lib/db/prisma";

export type PaymentReconciliationRiskLevel = "healthy" | "warning" | "critical";

export type PaymentReconciliationRisk = {
  detail: string;
  href: string;
  label: string;
  level: PaymentReconciliationRiskLevel;
  value: string;
};

export type PaymentReconciliationRow = {
  amountPence: number;
  createdAt: string;
  customerEmail: string;
  customerName: string;
  href: string;
  id: string;
  label: string;
  paypalOrderId: string | null;
  status: string;
  type: "stars" | "shop" | "music" | "music-cart";
};

export type PaymentReconciliationData = {
  checkedAt: string;
  recentStalePending: PaymentReconciliationRow[];
  risks: PaymentReconciliationRisk[];
  staleAfterMinutes: number;
  stats: {
    failedWebhooks24h: number;
    paidMusicPurchasesMissingDelivery: number;
    paidOrdersMissingCapture: number;
    staleMusicCheckouts: number;
    staleMusicPurchases: number;
    staleReceivedWebhooks: number;
    staleShopOrders: number;
    staleStarPurchases: number;
  };
};

export const stalePendingPaymentMinutes = 30;

export function paymentReconciliationRisk({
  count,
  critical,
  detail,
  healthyDetail,
  href,
  label,
  plural,
  singular
}: {
  count: number;
  critical?: boolean;
  detail: string;
  healthyDetail: string;
  href: string;
  label: string;
  plural: string;
  singular: string;
}): PaymentReconciliationRisk {
  return {
    detail: count > 0 ? detail : healthyDetail,
    href,
    label,
    level: count > 0 ? (critical ? "critical" : "warning") : "healthy",
    value: count > 0 ? `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}` : "Clean"
  };
}

export function paymentReconciliationStaleCutoff(now = new Date(), minutes = stalePendingPaymentMinutes) {
  return new Date(now.getTime() - minutes * 60 * 1000);
}

function toStaleRow(
  row:
    | {
        id: string;
        createdAt: Date;
        status: string;
        totalPence: number;
        paypalOrderId: string | null;
        user: {
          displayName: string;
          email: string;
        };
      }
    | {
        id: string;
        createdAt: Date;
        status: string;
        pricePence: number;
        paypalOrderId: string | null;
        buyer: {
          displayName: string;
          email: string;
        };
        trackTitle: string;
      }
    | {
        id: string;
        createdAt: Date;
        status: string;
        totalPence: number;
        paypalOrderId: string | null;
        buyer: {
          displayName: string;
          email: string;
        };
      },
  type: PaymentReconciliationRow["type"]
): PaymentReconciliationRow {
  const user = "user" in row ? row.user : row.buyer;
  const amountPence = "pricePence" in row ? row.pricePence : row.totalPence;
  const label =
    type === "stars"
      ? "Stars purchase"
      : type === "shop"
        ? "Shop order"
        : type === "music-cart"
          ? "Music basket"
          : "trackTitle" in row
            ? row.trackTitle
            : "Music purchase";

  return {
    amountPence,
    createdAt: row.createdAt.toISOString(),
    customerEmail: user.email,
    customerName: user.displayName,
    href:
      type === "stars"
        ? "/admin/stars"
        : type === "shop"
          ? "/admin/orders"
          : "/admin/tracks",
    id: row.id,
    label,
    paypalOrderId: row.paypalOrderId,
    status: row.status,
    type
  };
}

export async function getPaymentReconciliationData(now = new Date()): Promise<PaymentReconciliationData> {
  const pendingCutoff = paymentReconciliationStaleCutoff(now);
  const webhookStaleCutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const recentWebhookCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stalePendingWhere = {
    createdAt: {
      lt: pendingCutoff
    },
    status: "pending"
  };
  const [
    staleStarPurchases,
    staleShopOrders,
    staleMusicPurchases,
    staleMusicCheckouts,
    failedWebhooks24h,
    staleReceivedWebhooks,
    paidMusicPurchasesMissingDelivery,
    paidOrdersMissingCapture,
    starRows,
    shopRows,
    musicRows,
    musicCheckoutRows
  ] = await Promise.all([
    prisma.starPurchase.count({
      where: stalePendingWhere
    }),
    prisma.order.count({
      where: stalePendingWhere
    }),
    prisma.digitalTrackPurchase.count({
      where: stalePendingWhere
    }),
    prisma.musicCheckout.count({
      where: stalePendingWhere
    }),
    prisma.payPalWebhookEvent.count({
      where: {
        processingStatus: "failed",
        receivedAt: {
          gte: recentWebhookCutoff
        }
      }
    }),
    prisma.payPalWebhookEvent.count({
      where: {
        processingStatus: "received",
        receivedAt: {
          lt: webhookStaleCutoff
        }
      }
    }),
    prisma.digitalTrackPurchase.count({
      where: {
        status: "paid",
        OR: [{ downloadUrl: null }, { downloadUrl: "" }],
        track: {
          OR: [{ downloadUrl: null }, { downloadUrl: "" }]
        }
      }
    }),
    prisma.order.count({
      where: {
        paypalCaptureId: null,
        status: {
          in: ["paid", "processing", "fulfilled"]
        }
      }
    }),
    prisma.starPurchase.findMany({
      include: {
        user: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 5,
      where: stalePendingWhere
    }),
    prisma.order.findMany({
      include: {
        user: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 5,
      where: stalePendingWhere
    }),
    prisma.digitalTrackPurchase.findMany({
      include: {
        buyer: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 5,
      where: stalePendingWhere
    }),
    prisma.musicCheckout.findMany({
      include: {
        buyer: {
          select: {
            displayName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 5,
      where: stalePendingWhere
    })
  ]);

  const totalStalePending = staleStarPurchases + staleShopOrders + staleMusicPurchases + staleMusicCheckouts;
  const stats = {
    failedWebhooks24h,
    paidMusicPurchasesMissingDelivery,
    paidOrdersMissingCapture,
    staleMusicCheckouts,
    staleMusicPurchases,
    staleReceivedWebhooks,
    staleShopOrders,
    staleStarPurchases
  };

  return {
    checkedAt: now.toISOString(),
    recentStalePending: [
      ...starRows.map((row) => toStaleRow(row, "stars")),
      ...shopRows.map((row) => toStaleRow(row, "shop")),
      ...musicRows.map((row) => toStaleRow(row, "music")),
      ...musicCheckoutRows.map((row) => toStaleRow(row, "music-cart"))
    ]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(0, 12),
    risks: [
      paymentReconciliationRisk({
        count: totalStalePending,
        detail: `Pending PayPal checkout records older than ${stalePendingPaymentMinutes} minutes may be abandoned, blocked at PayPal, or missing a return/webhook completion.`,
        healthyDetail: `No pending checkout records are older than ${stalePendingPaymentMinutes} minutes.`,
        href: "/admin/payments",
        label: "Stale pending checkouts",
        plural: "records",
        singular: "record"
      }),
      paymentReconciliationRisk({
        count: failedWebhooks24h,
        critical: true,
        detail: "PayPal webhooks failed during processing in the last 24 hours and need investigation.",
        healthyDetail: "No failed PayPal webhooks in the last 24 hours.",
        href: "/admin/payments",
        label: "Failed PayPal webhooks",
        plural: "events",
        singular: "event"
      }),
      paymentReconciliationRisk({
        count: staleReceivedWebhooks,
        detail: "PayPal webhooks are still marked received after 15 minutes and may be stuck before reconciliation.",
        healthyDetail: "No PayPal webhooks are stuck in received state.",
        href: "/admin/payments",
        label: "Unprocessed PayPal webhooks",
        plural: "events",
        singular: "event"
      }),
      paymentReconciliationRisk({
        count: paidMusicPurchasesMissingDelivery,
        critical: true,
        detail: "Paid music purchases without a stored or current track delivery URL will fail when customers download.",
        healthyDetail: "All paid music purchases resolve to a delivery URL.",
        href: "/admin/tracks?repair=missing-delivery",
        label: "Paid music delivery",
        plural: "purchases",
        singular: "purchase"
      }),
      paymentReconciliationRisk({
        count: paidOrdersMissingCapture,
        detail: "Shop orders marked paid, processing, or fulfilled without a PayPal capture ID may have been manually advanced or missed capture reconciliation.",
        healthyDetail: "All paid/active shop orders have PayPal capture references.",
        href: "/admin/orders",
        label: "Shop capture references",
        plural: "orders",
        singular: "order"
      })
    ],
    staleAfterMinutes: stalePendingPaymentMinutes,
    stats
  };
}
