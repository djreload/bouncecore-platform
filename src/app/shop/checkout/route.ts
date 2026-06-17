import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appOrigin, appUrl } from "@/lib/http/app-url";
import { startShopCartCheckout } from "@/lib/shop/checkout-service";

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
    const variantIds = formData.getAll("variantId").filter((variantId): variantId is string => typeof variantId === "string");
    const quantities = formData.getAll("quantity").filter((quantity): quantity is string => typeof quantity === "string");
    const checkout = await startShopCartCheckout(user.id, {
      items: variantIds.map((variantId, index) => ({
        quantity: quantities[index] ?? "1",
        variantId
      })),
      origin: appOrigin(request),
    });

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const checkout = message.includes("PayPal") ? "paypal-not-ready" : "error";

    return shopRedirect(request, checkout);
  }
}
