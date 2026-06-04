import { NextResponse } from "next/server";
import { getLiveStarSupportData } from "@/lib/stars/star-send-service";

export async function GET() {
  try {
    return NextResponse.json(await getLiveStarSupportData());
  } catch {
    return NextResponse.json({ error: "Live star support data is not available right now." }, { status: 500 });
  }
}
