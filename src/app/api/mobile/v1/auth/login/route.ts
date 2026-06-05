import { NextResponse } from "next/server";
import { loginUser, sessionMaxAgeSeconds } from "@/lib/auth/auth-service";
import { loginSchema } from "@/lib/auth/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    return NextResponse.json({
      authenticated: true,
      token: result.token,
      tokenType: "Bearer",
      expiresIn: sessionMaxAgeSeconds
    });
  } catch {
    return NextResponse.json({ error: "Login is not available right now." }, { status: 500 });
  }
}
