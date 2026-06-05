import { NextResponse } from "next/server";
import { getMobileEndpoints } from "@/lib/mobile/public-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    apiVersion: "mobile-v1",
    endpoints: getMobileEndpoints()
  });
}
