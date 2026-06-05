import { NextResponse } from "next/server";
import { getMobileMusicPayload } from "@/lib/mobile/public-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMobileMusicPayload());
  } catch {
    return NextResponse.json({ error: "Music data is not available right now." }, { status: 500 });
  }
}
