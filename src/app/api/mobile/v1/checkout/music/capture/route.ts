import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { captureMobileMusicCheckout, type MobileCheckoutPayload } from "@/lib/mobile/checkout-api";
import { mobileActionError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = (await request.json().catch(() => ({}))) as MobileCheckoutPayload;

    return NextResponse.json(await captureMobileMusicCheckout(user, payload));
  } catch (error) {
    return mobileActionError(error, "Music checkout could not be captured.");
  }
}
