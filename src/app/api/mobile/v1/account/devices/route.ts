import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { getMobileDevices, registerMobileDevice, revokeMobileDevice, type MobileDeviceInput } from "@/lib/mobile/device-service";
import { mobileActionError, mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function inputString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function deviceInput(payload: Record<string, unknown>): MobileDeviceInput {
  return {
    appVersion: inputString(payload, "appVersion"),
    deviceName: inputString(payload, "deviceName"),
    osVersion: inputString(payload, "osVersion"),
    platform: inputString(payload, "platform"),
    provider: inputString(payload, "provider"),
    pushToken: inputString(payload, "pushToken")
  };
}

export async function GET() {
  try {
    const user = await requireMobileUser();

    return NextResponse.json(await getMobileDevices(user));
  } catch (error) {
    return mobileRouteError(error, "Mobile devices are not available right now.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => null);

    if (!isObject(payload)) {
      return NextResponse.json({ error: "Send a JSON device payload." }, { status: 400 });
    }

    return NextResponse.json({ device: await registerMobileDevice(user, deviceInput(payload)), ok: true }, { status: 201 });
  } catch (error) {
    return mobileActionError(error, "Mobile device could not be registered.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireMobileUser();
    const payload = await request.json().catch(() => null);

    if (!isObject(payload) || typeof payload.deviceId !== "string") {
      return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
    }

    return NextResponse.json(await revokeMobileDevice(user, payload.deviceId));
  } catch (error) {
    return mobileActionError(error, "Mobile device could not be revoked.");
  }
}
