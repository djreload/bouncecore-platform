import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { completeTrackCheckout } from "@/lib/music/track-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?error=auth-required", request.url));
  }

  const purchaseId = request.nextUrl.searchParams.get("purchaseId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";

  try {
    const purchase = await completeTrackCheckout(user.id, purchaseId, paypalOrderId);
    const url = new URL("/music", request.url);

    revalidatePath("/music");
    revalidatePath("/producer/sales");
    revalidatePath("/admin/audit-logs");

    url.searchParams.set("checkout", "success");
    url.searchParams.set("purchase", purchase.id);

    return NextResponse.redirect(url);
  } catch {
    const url = new URL("/music", request.url);

    url.searchParams.set("checkout", "capture-error");

    return NextResponse.redirect(url);
  }
}
