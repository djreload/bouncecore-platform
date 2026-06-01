import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { completeStarsCheckout } from "@/lib/rewards/stars-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?error=auth-required", request.url));
  }

  const purchaseId = request.nextUrl.searchParams.get("purchaseId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";

  try {
    const purchase = await completeStarsCheckout(user.id, purchaseId, paypalOrderId);
    const url = new URL("/account/rewards", request.url);

    revalidatePath("/account/rewards");
    revalidatePath("/admin/stars");
    revalidatePath("/admin/supporters");
    revalidatePath("/rewards");

    url.searchParams.set("checkout", "success");
    url.searchParams.set("purchase", purchase.id);

    return NextResponse.redirect(url);
  } catch {
    const url = new URL("/account/rewards", request.url);

    url.searchParams.set("checkout", "capture-error");

    return NextResponse.redirect(url);
  }
}
