import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    user
      : user
        ? {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            roles: user.roles
          }
        : null
  });
}
