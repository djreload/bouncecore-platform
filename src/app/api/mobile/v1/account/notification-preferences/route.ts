import { NextResponse } from "next/server";
import {
  getMobileNotificationPreferencesPayload,
  requireMobileUser,
  updateMobileNotificationPreferencesPayload
} from "@/lib/mobile/account-api";
import { mobileActionError, mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

function preferenceInput(payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "preferences" in payload) {
    return payload.preferences;
  }

  return payload;
}

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileNotificationPreferencesPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Notification preferences are not available right now.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Send a JSON notification preference payload." }, { status: 400 });
    }

    return NextResponse.json(await updateMobileNotificationPreferencesPayload(user, preferenceInput(payload)));
  } catch (error) {
    return mobileActionError(error, "Notification preferences could not be saved.");
  }
}
