import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/cookies";
import { formValue, loginSchema } from "@/lib/auth/validation";
import { appUrl } from "@/lib/http/app-url";
import { applyRateLimitHeaders, consumeRequestRateLimit } from "@/lib/security/request-rate-limit";

export async function POST(request: Request) {
  const rateLimit = await consumeRequestRateLimit(request, { limit: 20, scope: "auth:login", windowSeconds: 600 });
  if (!rateLimit.allowed) {
    return applyRateLimitHeaders(NextResponse.redirect(appUrl(request, "/auth/login", { error: "rate-limited" }), 303), rateLimit);
  }

  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "invalid-input" }), 303);
  }

  let result;

  try {
    result = await loginUser(parsed.data);
  } catch {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "database-unavailable" }), 303);
  }

  const response = NextResponse.redirect(appUrl(request, result.redirectTo), 303);

  if (result.ok) {
    setSessionCookie(response, result.token);
  }

  return applyRateLimitHeaders(response, rateLimit);
}
