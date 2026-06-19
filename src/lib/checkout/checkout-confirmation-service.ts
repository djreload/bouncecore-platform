import { formatMoney, notifyAccountUserOnce } from "@/lib/account/notification-email-service";
import { prisma } from "@/lib/db/prisma";

type ConfirmationMailInput = {
  body: string;
  dedupeKey: string;
  htmlLines: string[];
  subject: string;
  textLines: string[];
  title: string;
  type: string;
  user: {
    displayName: string;
    email: string;
    id: string;
  };
};

async function notifyAndEmailOnce(input: ConfirmationMailInput) {
  await notifyAccountUserOnce({
    ...input,
    auditActionPrefix: "checkout.confirmation"
  });
}

export async function notifyShopOrderPaid(orderId: string) {
  const order = await prisma.order.findUnique({
    include: {
      items: true,
      user: {
        select: {
          displayName: true,
          email: true,
          id: true
        }
      }
    },
    where: {
      id: orderId
    }
  });

  if (!order || order.status !== "paid") {
    return;
  }

  const itemSummary = order.items
    .map((item) => `${item.quantity} x ${item.productName} (${item.variantName})`)
    .join(", ");
  const amount = formatMoney(order.totalPence, order.currency);

  await notifyAndEmailOnce({
    body: `Your shop order for ${amount} has been paid and is ready for fulfilment.`,
    dedupeKey: `shop-order-paid:${order.id}`,
    htmlLines: [
      `Hi ${order.user.displayName},`,
      `Your Bouncecore shop order has been paid.`,
      `Order: ${order.id}`,
      `Total: ${amount}`,
      `Items: ${itemSummary || "Shop items"}`
    ],
    subject: "Bouncecore shop order confirmed",
    textLines: [
      `Hi ${order.user.displayName},`,
      "",
      "Your Bouncecore shop order has been paid.",
      `Order: ${order.id}`,
      `Total: ${amount}`,
      `Items: ${itemSummary || "Shop items"}`
    ],
    title: "Shop order paid",
    type: "shop.order.paid",
    user: order.user
  });
}

function shopOrderStatusLabel(status: string) {
  switch (status) {
    case "processing":
      return "being processed";
    case "fulfilled":
      return "fulfilled";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    default:
      return status;
  }
}

export async function notifyShopOrderStatusUpdated(orderId: string, previousStatus: string) {
  const order = await prisma.order.findUnique({
    include: {
      items: true,
      user: {
        select: {
          displayName: true,
          email: true,
          id: true
        }
      }
    },
    where: {
      id: orderId
    }
  });

  if (!order || order.status === previousStatus || !["processing", "fulfilled", "cancelled", "refunded"].includes(order.status)) {
    return;
  }

  const itemSummary = order.items
    .map((item) => `${item.quantity} x ${item.productName} (${item.variantName})`)
    .join(", ");
  const label = shopOrderStatusLabel(order.status);

  await notifyAndEmailOnce({
    body: `Your shop order is now ${label}.`,
    dedupeKey: `shop-order-status:${order.id}:${order.status}`,
    htmlLines: [
      `Hi ${order.user.displayName},`,
      `Your Bouncecore shop order is now ${label}.`,
      `Order: ${order.id}`,
      `Previous status: ${previousStatus}`,
      `Items: ${itemSummary || "Shop items"}`
    ],
    subject: "Bouncecore shop order updated",
    textLines: [
      `Hi ${order.user.displayName},`,
      "",
      `Your Bouncecore shop order is now ${label}.`,
      `Order: ${order.id}`,
      `Previous status: ${previousStatus}`,
      `Items: ${itemSummary || "Shop items"}`
    ],
    title: "Shop order updated",
    type: `shop.order.${order.status}`,
    user: order.user
  });
}

export async function notifyMusicPurchasePaid(purchaseId: string) {
  const purchase = await prisma.digitalTrackPurchase.findUnique({
    include: {
      buyer: {
        select: {
          displayName: true,
          email: true,
          id: true
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
      }
    },
    where: {
      id: purchaseId
    }
  });

  if (!purchase || purchase.status !== "paid") {
    return;
  }

  const amount = formatMoney(purchase.pricePence, purchase.currency);

  await notifyAndEmailOnce({
    body: `${purchase.trackTitle} is now available in your music purchases.`,
    dedupeKey: `music-purchase-paid:${purchase.id}`,
    htmlLines: [
      `Hi ${purchase.buyer.displayName},`,
      `Your music purchase is confirmed.`,
      `Track: ${purchase.trackTitle}`,
      `Producer: ${purchase.producerName}`,
      `Total: ${amount}`
    ],
    subject: "Bouncecore music purchase confirmed",
    textLines: [
      `Hi ${purchase.buyer.displayName},`,
      "",
      "Your music purchase is confirmed.",
      `Track: ${purchase.trackTitle}`,
      `Producer: ${purchase.producerName}`,
      `Total: ${amount}`
    ],
    title: "Music purchase paid",
    type: "music.purchase.paid",
    user: purchase.buyer
  });

  await notifyAndEmailOnce({
    body: `${purchase.trackTitle} sold for ${amount}. Estimated producer earnings: ${formatMoney(purchase.producerEarningsPence, purchase.currency)}.`,
    dedupeKey: `producer-sale-paid:${purchase.id}`,
    htmlLines: [
      `Hi ${purchase.producer.user.displayName},`,
      `Your Bouncecore track sold.`,
      `Track: ${purchase.trackTitle}`,
      `Sale total: ${amount}`,
      `Estimated producer earnings: ${formatMoney(purchase.producerEarningsPence, purchase.currency)}`
    ],
    subject: "Bouncecore track sold",
    textLines: [
      `Hi ${purchase.producer.user.displayName},`,
      "",
      "Your Bouncecore track sold.",
      `Track: ${purchase.trackTitle}`,
      `Sale total: ${amount}`,
      `Estimated producer earnings: ${formatMoney(purchase.producerEarningsPence, purchase.currency)}`
    ],
    title: "Track sold",
    type: "producer.sale.paid",
    user: purchase.producer.user
  });
}

export async function notifyMusicCheckoutPaid(checkoutId: string) {
  const checkout = await prisma.musicCheckout.findUnique({
    include: {
      buyer: {
        select: {
          displayName: true,
          email: true,
          id: true
        }
      },
      purchases: {
        include: {
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
          }
        }
      }
    },
    where: {
      id: checkoutId
    }
  });

  if (!checkout || checkout.status !== "paid") {
    return;
  }

  const amount = formatMoney(checkout.totalPence, checkout.currency);
  const trackSummary = checkout.purchases.map((purchase) => purchase.trackTitle).join(", ");

  await notifyAndEmailOnce({
    body: `${checkout.purchases.length} music track${checkout.purchases.length === 1 ? "" : "s"} are now available in your purchases.`,
    dedupeKey: `music-checkout-paid:${checkout.id}`,
    htmlLines: [
      `Hi ${checkout.buyer.displayName},`,
      `Your music basket purchase is confirmed.`,
      `Tracks: ${trackSummary || "Music tracks"}`,
      `Total: ${amount}`
    ],
    subject: "Bouncecore music basket confirmed",
    textLines: [
      `Hi ${checkout.buyer.displayName},`,
      "",
      "Your music basket purchase is confirmed.",
      `Tracks: ${trackSummary || "Music tracks"}`,
      `Total: ${amount}`
    ],
    title: "Music basket paid",
    type: "music.checkout.paid",
    user: checkout.buyer
  });

  for (const purchase of checkout.purchases) {
    const trackAmount = formatMoney(purchase.pricePence, purchase.currency);
    const earnings = formatMoney(purchase.producerEarningsPence, purchase.currency);

    await notifyAndEmailOnce({
      body: `${purchase.trackTitle} sold for ${trackAmount}. Estimated producer earnings: ${earnings}.`,
      dedupeKey: `producer-sale-paid:${purchase.id}`,
      htmlLines: [
        `Hi ${purchase.producer.user.displayName},`,
        `Your Bouncecore track sold.`,
        `Track: ${purchase.trackTitle}`,
        `Sale total: ${trackAmount}`,
        `Estimated producer earnings: ${earnings}`
      ],
      subject: "Bouncecore track sold",
      textLines: [
        `Hi ${purchase.producer.user.displayName},`,
        "",
        "Your Bouncecore track sold.",
        `Track: ${purchase.trackTitle}`,
        `Sale total: ${trackAmount}`,
        `Estimated producer earnings: ${earnings}`
      ],
      title: "Track sold",
      type: "producer.sale.paid",
      user: purchase.producer.user
    });
  }
}

export async function notifyStarsPurchasePaid(purchaseId: string) {
  const purchase = await prisma.starPurchase.findUnique({
    include: {
      user: {
        select: {
          displayName: true,
          email: true,
          id: true
        }
      }
    },
    where: {
      id: purchaseId
    }
  });

  if (!purchase || purchase.status !== "paid") {
    return;
  }

  const amount = formatMoney(purchase.totalPence, purchase.currency);

  await notifyAndEmailOnce({
    body: `${purchase.stars.toLocaleString("en-GB")} stars have been added to your account.`,
    dedupeKey: `stars-purchase-paid:${purchase.id}`,
    htmlLines: [
      `Hi ${purchase.user.displayName},`,
      `Your stars purchase is confirmed.`,
      `Package: ${purchase.packageLabel}`,
      `Stars: ${purchase.stars.toLocaleString("en-GB")}`,
      `Total: ${amount}`
    ],
    subject: "Bouncecore stars added",
    textLines: [
      `Hi ${purchase.user.displayName},`,
      "",
      "Your stars purchase is confirmed.",
      `Package: ${purchase.packageLabel}`,
      `Stars: ${purchase.stars.toLocaleString("en-GB")}`,
      `Total: ${amount}`
    ],
    title: "Stars added",
    type: "stars.purchase.paid",
    user: purchase.user
  });
}
