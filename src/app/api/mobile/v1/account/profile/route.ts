import { NextResponse } from "next/server";
import { getMobileProfilePayload, requireMobileUser, updateMobileProfilePayload } from "@/lib/mobile/account-api";
import { mobileActionError, mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileProfilePayload(user));
  } catch (error) {
    return mobileRouteError(error, "Profile data is not available right now.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => null);

    if (!isObject(payload)) {
      return NextResponse.json({ error: "Send a JSON profile payload." }, { status: 400 });
    }

    return NextResponse.json(
      await updateMobileProfilePayload(user, {
        avatarUrl: optionalString(payload, "avatarUrl"),
        bio: optionalString(payload, "bio"),
        displayName: optionalString(payload, "displayName"),
        isPublic: typeof payload.isPublic === "boolean" ? payload.isPublic : undefined,
        location: optionalString(payload, "location"),
        slug: optionalString(payload, "slug"),
        websiteUrl: optionalString(payload, "websiteUrl")
      })
    );
  } catch (error) {
    return mobileActionError(error, "Profile could not be updated.");
  }
}
