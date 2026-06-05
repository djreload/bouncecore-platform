import { NextResponse } from "next/server";
import { searchTenorGifs } from "@/lib/chat/tenor-service";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireMobileUser();

    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";

    if (!query.trim()) {
      return NextResponse.json({ gifs: [] });
    }

    return NextResponse.json({ gifs: await searchTenorGifs(query) });
  } catch (error) {
    return mobileRouteError(error, "GIF search is not available right now.");
  }
}
