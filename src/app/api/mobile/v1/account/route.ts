import { NextResponse } from "next/server";
import { getMobileAccountPayload, requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileAccountPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Account data is not available right now.");
  }
}
