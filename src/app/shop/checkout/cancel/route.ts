import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { cancelShopCheckout } from "@/lib/shop/checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
    const paypalOrderId = request.nextUrl.searchParams.get("token") ?? undefined;

    try {
      await cancelShopCheckout(user.id, orderId, paypalOrderId);
    } catch {
      return NextResponse.redirect(appUrl(request, "/shop", { checkout: "error" }));
    }
  }

  return NextResponse.redirect(appUrl(request, "/shop", { checkout: "cancelled" }));
}
