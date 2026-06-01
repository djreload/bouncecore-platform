import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelShopCheckout } from "@/lib/shop/checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
    const paypalOrderId = request.nextUrl.searchParams.get("token") ?? undefined;

    try {
      await cancelShopCheckout(user.id, orderId, paypalOrderId);
    } catch {
      const errorUrl = new URL("/shop", request.url);

      errorUrl.searchParams.set("checkout", "error");

      return NextResponse.redirect(errorUrl);
    }
  }

  const url = new URL("/shop", request.url);
  url.searchParams.set("checkout", "cancelled");

  return NextResponse.redirect(url);
}
