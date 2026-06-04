import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appOrigin, appUrl } from "@/lib/http/app-url";
import { startShopCheckout } from "@/lib/shop/checkout-service";

function shopRedirect(request: NextRequest, checkout: string) {
  return NextResponse.redirect(appUrl(request, "/shop", { checkout }), 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }), 303);
  }

  try {
    const formData = await request.formData();
    const variantId = formData.get("variantId");
    const quantity = formData.get("quantity");
    const checkout = await startShopCheckout(user.id, {
      origin: appOrigin(request),
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
