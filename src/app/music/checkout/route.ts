import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appOrigin, appUrl } from "@/lib/http/app-url";
import { startTrackCheckout } from "@/lib/music/track-checkout-service";
import { paypalCheckoutErrorParam } from "@/lib/payments/paypal-checkout-errors";

function musicRedirect(request: NextRequest, checkout: string) {
  return NextResponse.redirect(appUrl(request, "/music", { checkout }), 303);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }), 303);
  }

  try {
    const formData = await request.formData();
    const trackId = formData.get("trackId");
    const checkout = await startTrackCheckout(user.id, {
      origin: appOrigin(request),
      trackId: typeof trackId === "string" ? trackId : ""
    });

    revalidatePath("/music");
    revalidatePath("/producer/sales");

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    return musicRedirect(request, paypalCheckoutErrorParam(error));
  }
}
