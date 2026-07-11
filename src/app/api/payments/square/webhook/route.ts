import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { completeSquareStarsCheckout } from "@/lib/rewards/stars-checkout-service";
import { completeSquareShopCheckout } from "@/lib/shop/checkout-service";
import {
  getSquareSettings,
  squareWebhookPaymentFromPayload,
  verifySquareWebhookSignature
} from "@/lib/payments/square-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const square = await getSquareSettings();
  const signature = request.headers.get("x-square-hmacsha256-signature");

  if (!verifySquareWebhookSignature(rawBody, signature, square)) {
    return NextResponse.json({ error: "Invalid Square webhook signature." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid Square webhook payload." }, { status: 400 });
  }

  const payment = squareWebhookPaymentFromPayload(payload);

  if (!payment || payment.status !== "COMPLETED") {
    return NextResponse.json({ status: "ignored" });
  }

  const [starPurchase, shopOrder] = await Promise.all([
    prisma.starPurchase.findUnique({
      where: {
        squareOrderId: payment.squareOrderId
      },
      select: {
        id: true,
        status: true,
        userId: true
      }
    }),
    prisma.order.findUnique({
      where: {
        squareOrderId: payment.squareOrderId
      },
      select: {
        id: true,
        status: true,
        userId: true
      }
    })
  ]);

  if (starPurchase?.status === "pending") {
    await completeSquareStarsCheckout(starPurchase.userId, starPurchase.id);
    revalidatePath("/account/rewards");
    revalidatePath("/admin/stars");
    revalidatePath("/admin/supporters");
    revalidatePath("/rewards");

    return NextResponse.json({ status: "processed", type: "stars" });
  }

  if (shopOrder?.status === "pending") {
    await completeSquareShopCheckout(shopOrder.userId, shopOrder.id);
    revalidatePath("/account/orders");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/fulfilment");

    return NextResponse.json({ status: "processed", type: "shop" });
  }

  return NextResponse.json({ status: "recorded" });
}
