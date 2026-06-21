import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getChatSheepThrowOverlayData } from "@/lib/chat/sheep-throw-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json(await getChatSheepThrowOverlayData(user?.id));
  } catch {
    return NextResponse.json({ error: "Sheep throw data is not available right now." }, { status: 500 });
  }
}
