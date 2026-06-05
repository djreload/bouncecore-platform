import { NextResponse } from "next/server";
import { registerUser, sessionMaxAgeSeconds } from "@/lib/auth/auth-service";
import { registerSchema } from "@/lib/auth/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration payload." }, { status: 400 });
  }

  try {
    const result = await registerUser(parsed.data);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        authenticated: true,
        token: result.token,
        tokenType: "Bearer",
        expiresIn: sessionMaxAgeSeconds
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Registration is not available right now." }, { status: 500 });
  }
}
