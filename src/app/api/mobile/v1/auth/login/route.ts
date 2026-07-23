import { NextResponse } from "next/server";
import { loginUser, sessionMaxAgeSeconds } from "@/lib/auth/auth-service";
import { loginSchema } from "@/lib/auth/validation";
import { applyRateLimitHeaders, consumeRequestRateLimit } from "@/lib/security/request-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = await consumeRequestRateLimit(request, { limit: 20, scope: "auth:login", windowSeconds: 600 });
  if (!rateLimit.allowed) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 }), rateLimit);
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload." }, { status: 400 });
  }

  try {
    const result = await loginUser(parsed.data);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return applyRateLimitHeaders(NextResponse.json({
      authenticated: true,
      token: result.token,
      tokenType: "Bearer",
      expiresIn: sessionMaxAgeSeconds
    }), rateLimit);
  } catch {
    return NextResponse.json({ error: "Login is not available right now." }, { status: 500 });
  }
}
