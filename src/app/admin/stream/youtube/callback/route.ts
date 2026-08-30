import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { appUrl } from "@/lib/http/app-url";
import {
  completeYouTubeOAuth,
  decodeYouTubeOAuthStateCookie,
  exchangeYouTubeAuthorizationCode,
  youtubeOAuthCookieName
} from "@/lib/stream/youtube-restream-oauth";

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
  const response = NextResponse.redirect(appUrl(request, "/admin/stream", { youtube: status, message }));

  response.cookies.set(youtubeOAuthCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/admin/stream/youtube",
    sameSite: "lax"
  });

  return response;
}

export async function GET(request: Request) {
  const actor = await getApiUserWithPermission("stream.settings.manage");

  if (!actor) {
    return redirectWithStatus(request, "auth-required", "Sign in as an owner or admin before connecting YouTube.");
  }

  const requestUrl = new URL(request.url);
  const providerError = requestUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithStatus(request, "denied", providerError);
  }

  const state = decodeYouTubeOAuthStateCookie(cookieValue(request, youtubeOAuthCookieName));
  const returnedState = requestUrl.searchParams.get("state");

  if (!state || state.actorId !== actor.id || !returnedState || returnedState !== state.state) {
    return redirectWithStatus(request, "state-error", "YouTube authorization expired or did not match this session.");
  }

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectWithStatus(request, "missing-code", "Google did not return an authorization code.");
  }

  try {
    const token = await exchangeYouTubeAuthorizationCode(request, code);

    await completeYouTubeOAuth({
      actorId: actor.id,
      slot: state.slot,
      token
    });

    return redirectWithStatus(request, "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube authorization could not be completed.";

    return redirectWithStatus(request, "failed", message);
  }
}
