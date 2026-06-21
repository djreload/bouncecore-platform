import { NextResponse } from "next/server";
import { getChatSheepThrowOverlayData } from "@/lib/chat/sheep-throw-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getChatSheepThrowOverlayData());
  } catch {
    return NextResponse.json({ error: "Sheep throw data is not available right now." }, { status: 500 });
  }
}
