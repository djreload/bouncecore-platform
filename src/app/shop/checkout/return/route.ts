import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { completeShopCheckout } from "@/lib/shop/checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";

  try {
    const order = await completeShopCheckout(user.id, orderId, paypalOrderId);

    return NextResponse.redirect(appUrl(request, "/account/orders", { checkout: "success", order: order.id }));
  } catch {
    return NextResponse.redirect(appUrl(request, "/shop", { checkout: "capture-error" }));
  }
}
