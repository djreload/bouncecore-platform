import { NextResponse } from "next/server";
import { getMobileRewardsPayload } from "@/lib/mobile/public-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMobileRewardsPayload());
  } catch {
    return NextResponse.json({ error: "Rewards data is not available right now." }, { status: 500 });
  }
}
