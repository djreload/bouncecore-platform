import { NextResponse } from "next/server";
import { getApiUserWithPermission } from "@/lib/auth/guards";
import { appUrl } from "@/lib/http/app-url";
import { restreamTargetSlotValue } from "@/lib/stream/restream-settings";
import {
  createFacebookOAuthState,
  encodeFacebookOAuthStateCookie,
  facebookAuthorizationUrl,
  facebookOAuthCookieName
} from "@/lib/stream/facebook-restream-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getApiUserWithPermission("stream.settings.manage");

  if (!actor) {
    return NextResponse.redirect(appUrl(request, "/auth/login", { error: "auth-required" }));
  }

  try {
    const slot = restreamTargetSlotValue(new URL(request.url).searchParams.get("slot"));
    const state = createFacebookOAuthState(actor.id, slot);
    const authorizationUrl = await facebookAuthorizationUrl(request, state);
    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(facebookOAuthCookieName, encodeFacebookOAuthStateCookie(state), {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/admin/stream/facebook",
      sameSite: "lax",
      secure: appUrl(request, "/").protocol === "https:"
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook OAuth is not configured.";
    return NextResponse.redirect(appUrl(request, "/admin/stream", { facebook: "failed", message }));
  }
}
