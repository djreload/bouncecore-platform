import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { searchUnifiedGifs } from "@/lib/chat/gif-provider-service";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "36");

  if (!query.trim()) {
    return NextResponse.json({ gifs: [], next: null });
  }

  try {
    const result = await searchUnifiedGifs(query, limit);

    return NextResponse.json({
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
  } catch {
    return NextResponse.json({ error: "GIF search is not available right now." }, { status: 503 });
  }
}
