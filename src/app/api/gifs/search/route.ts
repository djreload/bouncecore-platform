import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { searchUnifiedGifs } from "@/lib/chat/gif-provider-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "36");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  try {
    return NextResponse.json(await searchUnifiedGifs(query, limit, offset));
  } catch (error) {
    console.error("[gif-search] unified search failed", error);

    return NextResponse.json({ error: "GIF search is not available right now.", query, results: [] }, { status: 503 });
  }
}
