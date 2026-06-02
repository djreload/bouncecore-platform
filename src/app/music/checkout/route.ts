import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startTrackCheckout } from "@/lib/music/track-checkout-service";

function musicRedirect(request: NextRequest, checkout: string) {
  const url = new URL("/music", request.url);
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
    const trackId = formData.get("trackId");
    const checkout = await startTrackCheckout(user.id, {
      origin: request.nextUrl.origin,
      trackId: typeof trackId === "string" ? trackId : ""
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
