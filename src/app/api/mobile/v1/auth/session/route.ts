import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUserFromRequest();

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          roles: user.roles
        }
      : null
  });
}
