import { NextResponse } from "next/server";
import { getMobileChatPayload } from "@/lib/mobile/public-api";

export const dynamic = "force-dynamic";

function firstParam(value: string | null) {
  return value?.trim() || undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    return NextResponse.json(await getMobileChatPayload(firstParam(url.searchParams.get("room"))));
  } catch {
    return NextResponse.json({ error: "Chat data is not available right now." }, { status: 500 });
  }
}
