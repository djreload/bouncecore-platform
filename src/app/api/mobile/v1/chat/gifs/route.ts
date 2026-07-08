import { NextResponse } from "next/server";
import { searchUnifiedGifs } from "@/lib/chat/gif-provider-service";
import { requireMobileUser } from "@/lib/mobile/account-api";
import { mobileRouteError } from "@/lib/mobile/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireMobileUser();

    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "36");

    if (!query.trim()) {
      return NextResponse.json({ gifs: [], next: null, query: "", results: [] });
    }

    const result = await searchUnifiedGifs(query, limit);

    return NextResponse.json({
      ...result,
      gifs: result.results.map((gif) => ({
        height: gif.height ?? null,
        id: gif.id,
        previewUrl: gif.previewUrl,
        provider: gif.provider,
        rating: gif.rating ?? null,
        sourceUrl: gif.sourceUrl ?? null,
        title: gif.title,
        url: gif.gifUrl,
        width: gif.width ?? null
      })),
      next: null
    });
  } catch (error) {
    return mobileRouteError(error, "GIF search is not available right now.");
  }
}
