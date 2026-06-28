import { NextResponse } from "next/server";
import { requireMobileUser, spinMobileRewardWheelPayload } from "@/lib/mobile/account-api";
import { mobileActionError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => ({}));

    return NextResponse.json(await spinMobileRewardWheelPayload(user, payload));
  } catch (error) {
    return mobileActionError(error, "Reward wheel spin could not be completed.");
  }
}
