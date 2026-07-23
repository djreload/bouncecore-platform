import { NextResponse } from "next/server";
import { registerUser, sessionMaxAgeSeconds } from "@/lib/auth/auth-service";
import { registerSchema } from "@/lib/auth/validation";
import { applyRateLimitHeaders, consumeRequestRateLimit } from "@/lib/security/request-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimit = await consumeRequestRateLimit(request, { limit: 6, scope: "auth:register", windowSeconds: 3600 });
  if (!rateLimit.allowed) {
    return applyRateLimitHeaders(NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 }), rateLimit);
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration payload." }, { status: 400 });
  }

  try {
    const result = await registerUser(parsed.data);

    if (!result.ok) {
      if (result.error === "email-verification-required" || result.error === "email-verification-send-failed") {
        return NextResponse.json(
          {
            authenticated: false,
            error: result.error,
            verificationRequired: true
          },
          { status: 202 }
        );
      }

      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return applyRateLimitHeaders(NextResponse.json(
      {
        authenticated: true,
        token: result.token,
        tokenType: "Bearer",
        expiresIn: sessionMaxAgeSeconds
      },
      { status: 201 }
    ), rateLimit);
  } catch {
    return NextResponse.json({ error: "Registration is not available right now." }, { status: 500 });
  }
}
