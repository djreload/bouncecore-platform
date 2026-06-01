import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { completeShopCheckout } from "@/lib/shop/checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?error=auth-required", request.url));
  }

  const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";

  try {
    const order = await completeShopCheckout(user.id, orderId, paypalOrderId);
    const url = new URL("/account/orders", request.url);

    url.searchParams.set("checkout", "success");
    url.searchParams.set("order", order.id);

    return NextResponse.redirect(url);
  } catch {
    const url = new URL("/shop", request.url);

    url.searchParams.set("checkout", "capture-error");

    return NextResponse.redirect(url);
  }
}
