import { NextResponse } from "next/server";
import { getMobileDownloadDeliveryPayload, requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    purchaseId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireMobileUser();
    const { purchaseId } = await context.params;
    const payload = await getMobileDownloadDeliveryPayload(user, purchaseId);

    if (!payload) {
      return NextResponse.json({ error: "Download not found." }, { status: 404 });
    }

    if (!payload.downloadReady) {
      return NextResponse.json({ error: "Download URL is not configured yet.", ...payload }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return mobileRouteError(error, "Download is not available right now.");
  }
}
