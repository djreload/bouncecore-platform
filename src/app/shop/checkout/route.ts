import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appOrigin, appUrl } from "@/lib/http/app-url";
import { paypalCheckoutErrorParam } from "@/lib/payments/paypal-checkout-errors";
import { squareCheckoutErrorParam } from "@/lib/payments/square-checkout-errors";
import { startShopCartCheckout } from "@/lib/shop/checkout-service";

function shopRedirect(request: NextRequest, checkout: string) {
  return NextResponse.redirect(appUrl(request, "/shop", { checkout }), 303);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  let requestedProvider = "";

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }), 303);
  }

  try {
    const formData = await request.formData();
    const provider = formData.get("provider");
    requestedProvider = typeof provider === "string" ? provider : "";
    const variantIds = formData.getAll("variantId").filter((variantId): variantId is string => typeof variantId === "string");
    const quantities = formData.getAll("quantity").filter((quantity): quantity is string => typeof quantity === "string");
    const checkout = await startShopCartCheckout(user.id, {
      items: variantIds.map((variantId, index) => ({
        quantity: quantities[index] ?? "1",
        variantId
      })),
      origin: appOrigin(request),
      provider: requestedProvider || undefined,
      shippingAddress: {
        city: formString(formData, "shippingCity"),
        country: formString(formData, "shippingCountry"),
        county: formString(formData, "shippingCounty"),
        email: formString(formData, "shippingEmail"),
        line1: formString(formData, "shippingLine1"),
        line2: formString(formData, "shippingLine2"),
        name: formString(formData, "shippingName"),
        phone: formString(formData, "shippingPhone"),
        postcode: formString(formData, "shippingPostcode")
      }
    });

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    return shopRedirect(request, requestedProvider === "square" ? squareCheckoutErrorParam(error) : paypalCheckoutErrorParam(error));
  }
}
