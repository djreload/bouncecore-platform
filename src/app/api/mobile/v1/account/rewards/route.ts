import { NextResponse } from "next/server";
import { getMobileRewardsAccountPayload, requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileRewardsAccountPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Account rewards are not available right now.");
  }
}
