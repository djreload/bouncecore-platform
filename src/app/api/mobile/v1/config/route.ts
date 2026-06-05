import { NextResponse } from "next/server";
import { getPublicMobileConfig } from "@/lib/admin/mobile-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPublicMobileConfig());
}
