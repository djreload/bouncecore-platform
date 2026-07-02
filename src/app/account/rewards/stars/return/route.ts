import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { appUrl } from "@/lib/http/app-url";
import { completeSquareStarsCheckout, completeStarsCheckout } from "@/lib/rewards/stars-checkout-service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  const purchaseId = request.nextUrl.searchParams.get("purchaseId") ?? "";
  const paypalOrderId = request.nextUrl.searchParams.get("token") ?? "";
  const provider = request.nextUrl.searchParams.get("provider") ?? "paypal";

  try {
    const purchase =
      provider === "square"
        ? await completeSquareStarsCheckout(user.id, purchaseId)
        : await completeStarsCheckout(user.id, purchaseId, paypalOrderId);

    revalidatePath("/account/rewards");
    revalidatePath("/admin/stars");
    revalidatePath("/admin/supporters");
    revalidatePath("/rewards");

    return NextResponse.redirect(appUrl(request, "/account/rewards", { checkout: "success", purchase: purchase.id }));
  } catch {
    return NextResponse.redirect(appUrl(request, "/account/rewards", { checkout: "capture-error" }));
  }
}
