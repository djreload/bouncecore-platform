import { NextResponse } from "next/server";
import {
  createGoogleDriveOAuthState,
  encodeGoogleDriveOAuthStateCookie,
  googleDriveAuthorizationUrl,
  googleDriveOAuthCookieName
} from "@/lib/admin/google-drive-backup-oauth";
import { googleDriveDefaultFolder, googleDriveDefaultRemoteName } from "@/lib/admin/offsite-backup-targets";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { appUrl } from "@/lib/http/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function queryText(url: URL, key: string, fallback: string) {
  const value = url.searchParams.get(key)?.trim();

  return value || fallback;
}

export async function GET(request: Request) {
  const actor = await getApiUserWithPermission("settings.manage");

  if (!actor) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  const requestUrl = new URL(request.url);
  const state = createGoogleDriveOAuthState(
    actor.id,
    queryText(requestUrl, "remoteName", googleDriveDefaultRemoteName),
    queryText(requestUrl, "folder", googleDriveDefaultFolder)
  );

  try {
    const authUrl = googleDriveAuthorizationUrl(request, state);
    const response = NextResponse.redirect(authUrl);

    response.cookies.set(googleDriveOAuthCookieName, encodeGoogleDriveOAuthStateCookie(state), {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/admin/storage/google-drive",
      sameSite: "lax",
      secure: appUrl(request, "/").protocol === "https:"
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive OAuth is not configured.";

    return NextResponse.redirect(appUrl(request, "/admin/storage", { googleDrive: "missing-oauth", message }));
  }
}
