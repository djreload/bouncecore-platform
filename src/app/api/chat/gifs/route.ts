import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { searchTenorGifs } from "@/lib/chat/tenor-service";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ gifs: [] });
  }

  try {
    const gifs = await searchTenorGifs(query);

    return NextResponse.json({ gifs });
  } catch {
    return NextResponse.json({ error: "GIF search is not available right now." }, { status: 503 });
  }
}
