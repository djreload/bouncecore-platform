import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelTrackCheckout } from "@/lib/music/track-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    const purchaseId = request.nextUrl.searchParams.get("purchaseId") ?? "";
    const paypalOrderId = request.nextUrl.searchParams.get("token") ?? undefined;

    try {
      await cancelTrackCheckout(user.id, purchaseId, paypalOrderId);
      revalidatePath("/music");
      revalidatePath("/producer/sales");
    } catch {
      const errorUrl = new URL("/music", request.url);

      errorUrl.searchParams.set("checkout", "error");

      return NextResponse.redirect(errorUrl);
    }
  }

  const url = new URL("/music", request.url);
  url.searchParams.set("checkout", "cancelled");

  return NextResponse.redirect(url);
}
