import { NextResponse } from "next/server";
import { requestPasswordReset, verificationOrigin } from "@/lib/auth/email-verification-service";
import { appUrl } from "@/lib/http/app-url";
import { applyRateLimitHeaders, consumeRequestRateLimit } from "@/lib/security/request-rate-limit";

export async function POST(request: Request) {
  const rateLimit = await consumeRequestRateLimit(request, { limit: 5, scope: "auth:password-reset", windowSeconds: 3600 });
  if (!rateLimit.allowed) {
    return applyRateLimitHeaders(NextResponse.redirect(appUrl(request, "/auth/forgot-password", { error: "rate-limited" }), 303), rateLimit);
  }

  const formData = await request.formData();
  const email = formData.get("email");

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.redirect(appUrl(request, "/auth/forgot-password", { error: "missing-email" }), 303);
  }

  const result = await requestPasswordReset(email, verificationOrigin(request));

  return applyRateLimitHeaders(NextResponse.redirect(
    appUrl(request, "/auth/forgot-password", {
      email,
      status: result.status
    }),
    303
  ), rateLimit);
}
