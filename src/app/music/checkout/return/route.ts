import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { completeTrackCheckout } from "@/lib/music/track-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  const purchaseId = request.nextUrl.searchParams.get("purchaseId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";

  try {
    const purchase = await completeTrackCheckout(user.id, purchaseId, paypalOrderId);

    revalidatePath("/music");
    revalidatePath("/producer/sales");
    revalidatePath("/admin/audit-logs");

    return NextResponse.redirect(appUrl(request, "/music", { checkout: "success", purchase: purchase.id }));
  } catch {
    return NextResponse.redirect(appUrl(request, "/music", { checkout: "capture-error" }));
  }
}
