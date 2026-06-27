import { NextResponse } from "next/server";
import { getRequestTokenHash, touchSessionActivity } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const touched = await touchSessionActivity(await getRequestTokenHash());

    return NextResponse.json({
      ok: true,
      active: touched > 0
    });
  } catch {
    return NextResponse.json({
      ok: false,
      active: false
    });
  }
}
