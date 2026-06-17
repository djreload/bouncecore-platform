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

export async function notifyMusicPurchasePaid(purchaseId: string) {
  const purchase = await prisma.digitalTrackPurchase.findUnique({
    include: {
      buyer: {
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
      purchases: true
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
