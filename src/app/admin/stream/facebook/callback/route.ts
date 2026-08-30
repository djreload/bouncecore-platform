import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { appUrl } from "@/lib/http/app-url";
import { getRestreamSettings } from "@/lib/stream/restream-settings-service";
import {
  completeFacebookOAuth,
  decodeFacebookOAuthStateCookie,
  exchangeFacebookAuthorizationCode,
  facebookOAuthCookieName
} from "@/lib/stream/facebook-restream-oauth";

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
  const response = NextResponse.redirect(appUrl(request, "/admin/stream", { facebook: status, message }));

  response.cookies.set(facebookOAuthCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/admin/stream/facebook",
    sameSite: "lax"
  });

  return response;
}

export async function GET(request: Request) {
  const actor = await getApiUserWithPermission("stream.settings.manage");

  if (!actor) {
    return redirectWithStatus(request, "auth-required", "Sign in as an owner or admin before connecting Facebook.");
  }

  const requestUrl = new URL(request.url);
  const providerError = requestUrl.searchParams.get("error_message") || requestUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithStatus(request, "denied", providerError);
  }

  const state = decodeFacebookOAuthStateCookie(cookieValue(request, facebookOAuthCookieName));
  const returnedState = requestUrl.searchParams.get("state");

  if (!state || state.actorId !== actor.id || !returnedState || returnedState !== state.state) {
    return redirectWithStatus(request, "state-error", "Facebook authorization expired or did not match this session.");
  }

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectWithStatus(request, "missing-code", "Facebook did not return an authorization code.");
  }

  try {
    const [token, settings] = await Promise.all([
      exchangeFacebookAuthorizationCode(request, code),
      getRestreamSettings(state.slot)
    ]);

    await completeFacebookOAuth({
      actorId: actor.id,
      preferredPageId: settings.facebookPageId,
      slot: state.slot,
      token
    });

    return redirectWithStatus(request, "connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook authorization could not be completed.";
    return redirectWithStatus(request, "failed", message);
  }
}
