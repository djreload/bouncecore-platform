import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getChatSheepThrowOverlayData } from "@/lib/chat/sheep-throw-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json(await getChatSheepThrowOverlayData(user?.id), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "Sheep throw data is not available right now." },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
          Pragma: "no-cache"
        },
        status: 500
      }
    );
  }
}
