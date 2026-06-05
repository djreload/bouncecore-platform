import { NextResponse } from "next/server";
import { getMobileShopPayload } from "@/lib/mobile/public-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getMobileShopPayload());
  } catch {
    return NextResponse.json({ error: "Shop data is not available right now." }, { status: 500 });
  }
}
