import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { cancelTrackCartCheckout } from "@/lib/music/track-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    const checkoutId = request.nextUrl.searchParams.get("checkoutId") ?? "";
    const paypalOrderId = request.nextUrl.searchParams.get("token") ?? undefined;

    try {
      await cancelTrackCartCheckout(user.id, checkoutId, paypalOrderId);
      revalidatePath("/music");
      revalidatePath("/producer/sales");
    } catch {
      return NextResponse.redirect(appUrl(request, "/music", { checkout: "error" }));
    }
  }

  return NextResponse.redirect(appUrl(request, "/music", { checkout: "cancelled" }));
}
