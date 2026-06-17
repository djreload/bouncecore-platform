import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { mailIsConfigured, sendMail } from "@/lib/mail/smtp-service";

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

function formatMoney(pence: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency"
  }).format(pence / 100);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailHtml(title: string, lines: string[]) {
  return `<main style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><h1>${escapeHtml(
    title
  )}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</main>`;
}

async function createNotificationOnce(input: ConfirmationMailInput) {
  const existing = await prisma.notification.findUnique({
    select: {
      id: true
    },
    where: {
      dedupeKey: input.dedupeKey
    }
  });

  if (existing) {
    return false;
  }

  try {
    await prisma.notification.create({
      data: {
        body: input.body,
        dedupeKey: input.dedupeKey,
        title: input.title,
        type: input.type,
        userId: input.user.id
      }
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }

    throw error;
  }
}

async function notifyAndEmailOnce(input: ConfirmationMailInput) {
  const created = await createNotificationOnce(input);

  if (!created) {
    return;
  }

  let mailResult:
    | Awaited<ReturnType<typeof sendMail>>
    | {
        configured: true;
        reason: string;
        sent: false;
      };

  try {
    mailResult = await sendMail({
      html: emailHtml(input.subject, input.htmlLines),
      subject: input.subject,
      text: input.textLines.join("\n"),
      to: input.user.email
    });
  } catch (error) {
    mailResult = {
      configured: mailIsConfigured(),
      reason: error instanceof Error ? error.message : "Email send failed.",
      sent: false
    };
  }

  const metadata: Record<string, boolean | string> = {
    configured: mailResult.configured,
    type: input.type
  };

  if ("reason" in mailResult) {
    metadata.reason = mailResult.reason;
  }

  await writeAuditLog({
    actorId: input.user.id,
    action: mailResult.sent ? "checkout.confirmation.email_sent" : "checkout.confirmation.email_not_sent",
    target: input.dedupeKey,
    severity: mailResult.sent ? "info" : "warning",
    metadata: metadata as Prisma.InputJsonObject
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
