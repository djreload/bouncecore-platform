import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appOrigin, appUrl } from "@/lib/http/app-url";
import { startTrackCartCheckout } from "@/lib/music/track-checkout-service";

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
    const trackIds = formData.getAll("trackId").filter((trackId): trackId is string => typeof trackId === "string");
    const checkout = await startTrackCartCheckout(user.id, {
      origin: appOrigin(request),
      trackIds
    });

    revalidatePath("/music");
    revalidatePath("/producer/sales");

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const checkout = message.includes("PayPal") ? "paypal-not-ready" : "error";

    return musicRedirect(request, checkout);
  }
}
