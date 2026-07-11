import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { completeShopCheckout, completeSquareShopCheckout } from "@/lib/shop/checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";
  const provider = request.nextUrl.searchParams.get("provider") ?? "paypal";

  try {
    const order =
      provider === "square" ? await completeSquareShopCheckout(user.id, orderId) : await completeShopCheckout(user.id, orderId, paypalOrderId);

    return NextResponse.redirect(appUrl(request, "/account/orders", { checkout: "success", order: order.id }));
  } catch {
    return NextResponse.redirect(appUrl(request, "/shop", { checkout: "capture-error" }));
  }
}
