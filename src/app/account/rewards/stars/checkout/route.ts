import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startStarsCheckout } from "@/lib/rewards/stars-checkout-service";

function rewardsRedirect(request: NextRequest, checkout: string) {
  const url = new URL("/account/rewards", request.url);
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
    const packageId = formData.get("packageId");
    const checkout = await startStarsCheckout(user.id, {
      origin: request.nextUrl.origin,
      packageId: typeof packageId === "string" ? packageId : ""
    });

    revalidatePath("/account/rewards");
    revalidatePath("/admin/stars");

    return NextResponse.redirect(checkout.approvalUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const checkout = message.includes("PayPal") ? "paypal-not-ready" : "error";

    return rewardsRedirect(request, checkout);
  }
}
