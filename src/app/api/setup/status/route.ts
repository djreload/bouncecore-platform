import { NextResponse } from "next/server";
import { getOwnerSetupStatus } from "@/lib/setup/owner-bootstrap";

export async function GET() {
  return NextResponse.json(await getOwnerSetupStatus());
}
