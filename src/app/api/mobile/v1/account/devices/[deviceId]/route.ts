import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { revokeMobileDevice } from "@/lib/mobile/device-service";
import { mobileActionError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    deviceId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireMobileUser();
    const { deviceId } = await context.params;

    return NextResponse.json(await revokeMobileDevice(user, deviceId));
  } catch (error) {
    return mobileActionError(error, "Mobile device could not be revoked.");
  }
}
