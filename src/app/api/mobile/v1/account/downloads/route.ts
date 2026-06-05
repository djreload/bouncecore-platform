import { NextResponse } from "next/server";
import { getMobileDownloadsPayload, requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileDownloadsPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Downloads are not available right now.");
  }
}
