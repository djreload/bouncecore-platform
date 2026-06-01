import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startShopCheckout } from "@/lib/shop/checkout-service";

function shopRedirect(request: NextRequest, checkout: string) {
  const url = new URL("/shop", request.url);
  url.searchParams.set("checkout", checkout);

  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?error=auth-required", request.url), 303);
  }

  try {
    const formData = await request.formData();
    const variantId = formData.get("variantId");
    const quantity = formData.get("quantity");
    const checkout = await startShopCheckout(user.id, {
      origin: request.nextUrl.origin,
      quantity: typeof quantity === "string" ? quantity : "",
      variantId: typeof variantId === "string" ? variantId : ""
    });

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const checkout = message.includes("PayPal") ? "paypal-not-ready" : "error";

    return shopRedirect(request, checkout);
  }
}
