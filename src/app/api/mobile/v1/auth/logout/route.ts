import { NextResponse } from "next/server";
import { revokeSessionByHash } from "@/lib/auth/auth-service";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { getRequestTokenHash } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await revokeSessionByHash(await getRequestTokenHash());

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  return response;
}
