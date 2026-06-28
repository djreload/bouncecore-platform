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
  const position = url.searchParams.get("pos") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ gifs: [], next: null });
  }

  try {
    const result = await searchTenorGifs(query, position);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "GIF search is not available right now." }, { status: 503 });
  }
}
