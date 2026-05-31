import { cookies } from "next/headers";
import type { CurrentUser } from "@/lib/auth/rbac";
import { hashSecretToken } from "@/lib/auth/tokens";

export const sessionCookieName = "bouncecore_session";

export async function getSessionTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  return token ? hashSecretToken(token) : null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const tokenHash = await getSessionTokenHash();

  if (!tokenHash) {
    return null;
  }

  // Database-backed session lookup is wired in the next auth implementation slice.
  return null;
}
