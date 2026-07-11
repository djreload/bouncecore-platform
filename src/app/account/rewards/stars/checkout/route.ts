import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appOrigin, appUrl } from "@/lib/http/app-url";
import { paypalCheckoutErrorParam } from "@/lib/payments/paypal-checkout-errors";
import { squareCheckoutErrorParam } from "@/lib/payments/square-checkout-errors";
import { startStarsCheckout } from "@/lib/rewards/stars-checkout-service";

function rewardsRedirect(request: NextRequest, checkout: string) {
  return NextResponse.redirect(appUrl(request, "/account/rewards", { checkout }), 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  let requestedProvider = "";

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }), 303);
  }

  try {
    const formData = await request.formData();
    const packageId = formData.get("packageId");
    const provider = formData.get("provider");
    requestedProvider = typeof provider === "string" ? provider : "";
    const checkout = await startStarsCheckout(user.id, {
      origin: appOrigin(request),
      packageId: typeof packageId === "string" ? packageId : "",
      provider: requestedProvider || undefined
    });

    revalidatePath("/account/rewards");
    revalidatePath("/admin/stars");

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    return rewardsRedirect(request, requestedProvider === "square" ? squareCheckoutErrorParam(error) : paypalCheckoutErrorParam(error));
  }
}
