import { NextResponse } from "next/server";
import {
  completeGoogleDriveBackupOAuth,
  decodeGoogleDriveOAuthStateCookie,
  exchangeGoogleDriveAuthorizationCode,
  googleDriveOAuthCookieName
} from "@/lib/admin/google-drive-backup-oauth";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { appUrl } from "@/lib/http/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const prefix = `${name}=`;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}

function redirectWithStatus(request: Request, status: string, message?: string) {
  const response = NextResponse.redirect(appUrl(request, "/admin/storage", { googleDrive: status, message }));

  response.cookies.set(googleDriveOAuthCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/admin/storage/google-drive",
    sameSite: "lax"
  });

  return response;
}

export async function GET(request: Request) {
  const actor = await getApiUserWithPermission("settings.manage");

  if (!actor) {
    return redirectWithStatus(request, "auth-required", "Sign in as an owner before connecting Google Drive.");
  }

  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");

  if (error) {
    return redirectWithStatus(request, "denied", error);
  }

  const state = decodeGoogleDriveOAuthStateCookie(cookieValue(request, googleDriveOAuthCookieName));
  const returnedState = requestUrl.searchParams.get("state");

  if (!state || state.actorId !== actor.id || !returnedState || returnedState !== state.state) {
    return redirectWithStatus(request, "state-error", "Google Drive authorization expired or did not match this session.");
  }

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectWithStatus(request, "missing-code", "Google did not return an authorization code.");
  }

  try {
    const token = await exchangeGoogleDriveAuthorizationCode(request, code);

    await completeGoogleDriveBackupOAuth({
      actorId: actor.id,
      folder: state.folder,
      remoteName: state.remoteName,
      request,
      token
    });

    return redirectWithStatus(request, "connected");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Google Drive authorization could not be completed.";

    return redirectWithStatus(request, "failed", message);
  }
}
