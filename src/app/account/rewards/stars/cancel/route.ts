import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelStarsCheckout } from "@/lib/rewards/stars-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    const purchaseId = request.nextUrl.searchParams.get("purchaseId") ?? "";
    const paypalOrderId = request.nextUrl.searchParams.get("token") ?? undefined;

    try {
      await cancelStarsCheckout(user.id, purchaseId, paypalOrderId);
      revalidatePath("/account/rewards");
      revalidatePath("/admin/stars");
    } catch {
      const errorUrl = new URL("/account/rewards", request.url);

      errorUrl.searchParams.set("checkout", "error");

      return NextResponse.redirect(errorUrl);
    }
  }

  const url = new URL("/account/rewards", request.url);
  url.searchParams.set("checkout", "cancelled");

  return NextResponse.redirect(url);
}
