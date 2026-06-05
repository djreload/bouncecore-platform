import { NextResponse } from "next/server";
import { MobileAuthError } from "@/lib/mobile/account-api";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export function mobileRouteError(error: unknown, message: string) {
  if (error instanceof MobileAuthError) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
