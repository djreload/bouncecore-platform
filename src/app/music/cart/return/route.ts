import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { completeTrackCartCheckout } from "@/lib/music/track-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  const checkoutId = request.nextUrl.searchParams.get("checkoutId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";

  try {
    await completeTrackCartCheckout(user.id, checkoutId, paypalOrderId);

    revalidatePath("/music");
    revalidatePath("/account/downloads");
    revalidatePath("/producer/sales");
    revalidatePath("/admin/audit-logs");

    return NextResponse.redirect(appUrl(request, "/account/downloads", { checkout: "music-success" }));
  } catch {
    return NextResponse.redirect(appUrl(request, "/music", { checkout: "capture-error" }));
  }
}
