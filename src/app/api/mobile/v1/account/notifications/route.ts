import { NextResponse } from "next/server";
import {
  clearAccountNotifications,
  markAccountNotificationRead,
  markAllAccountNotificationsRead
} from "@/lib/account/account-service";
import { getMobileNotificationsPayload, requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileNotificationsPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Notifications are not available right now.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireMobileUser();
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "all" in body && Boolean(body.all)) {
      await markAllAccountNotificationsRead(user.id);
    } else if (body && typeof body === "object" && "notificationId" in body && typeof body.notificationId === "string") {
      await markAccountNotificationRead(user.id, body.notificationId);
    } else {
      return NextResponse.json({ error: "Send notificationId or all=true." }, { status: 400 });
    }

    return NextResponse.json(await getMobileNotificationsPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Notification state could not be updated.");
  }
}

export async function DELETE() {
  try {
    const user = await requireMobileUser();

    await clearAccountNotifications(user.id);

    return NextResponse.json(await getMobileNotificationsPayload(user));
  } catch (error) {
    return mobileRouteError(error, "Notifications could not be cleared.");
  }
}
