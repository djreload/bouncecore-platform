import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  getSquareSettings,
  verifySquareWebhookSignature
} from "@/lib/payments/square-service";
import { processStoredSquareWebhookEvent, recordSquareWebhookEvent } from "@/lib/payments/square-webhook-service";

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

  try {
    const recorded = await recordSquareWebhookEvent(payload);
    const result = await processStoredSquareWebhookEvent(recorded.event.id);

    if (result.type === "stars") {
      revalidatePath("/account/rewards");
      revalidatePath("/admin/stars");
      revalidatePath("/admin/supporters");
      revalidatePath("/rewards");
    } else if (result.type === "shop") {
      revalidatePath("/account/orders");
      revalidatePath("/admin/orders");
      revalidatePath("/admin/fulfilment");
    }

    return NextResponse.json({ duplicate: recorded.duplicate, status: result.action, type: result.type });
  } catch (error) {
    console.error("Square webhook processing failed", error);
    return NextResponse.json({ error: "Square webhook processing failed." }, { status: 500 });
  }
}
