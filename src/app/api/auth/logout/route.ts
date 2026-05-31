import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { getSessionTokenHash } from "@/lib/auth/session";
import { revokeSessionByHash } from "@/lib/auth/auth-service";

export async function POST(request: Request) {
  try {
    await revokeSessionByHash(await getSessionTokenHash());
  } catch {
    // Logging out should still clear the browser cookie if the database is unavailable.
  }

  const response = NextResponse.redirect(new URL("/auth/login?status=signed-out", request.url), 303);
  clearSessionCookie(response);

  return response;
}
