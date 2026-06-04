import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { getSessionTokenHash } from "@/lib/auth/session";
import { revokeSessionByHash } from "@/lib/auth/auth-service";
import { appUrl } from "@/lib/http/app-url";

export async function POST(request: Request) {
  try {
    await revokeSessionByHash(await getSessionTokenHash());
  } catch {
    // Logging out should still clear the browser cookie if the database is unavailable.
  }

  const response = NextResponse.redirect(appUrl(request, "/auth/login", { status: "signed-out" }), 303);
  clearSessionCookie(response);

  return response;
}
