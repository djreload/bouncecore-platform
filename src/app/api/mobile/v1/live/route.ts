import { NextResponse } from "next/server";
import { getMobileLivePayload } from "@/lib/mobile/public-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMobileLivePayload());
  } catch {
    return NextResponse.json({ error: "Live data is not available right now." }, { status: 500 });
  }
}
