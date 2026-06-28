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
    const position = url.searchParams.get("pos") ?? "";

    if (!query.trim()) {
      return NextResponse.json({ gifs: [], next: null });
    }

    return NextResponse.json(await searchTenorGifs(query, position));
  } catch (error) {
    return mobileRouteError(error, "GIF search is not available right now.");
  }
}
