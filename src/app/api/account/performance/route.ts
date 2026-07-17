import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { defaultPerformancePreferences } from "@/lib/account/performance-preferences-core";
import {
  getUserPerformancePreferences,
  updateUserPerformancePreferences
} from "@/lib/account/performance-preferences-service";

const noStoreHeaders = {
  "Cache-Control": "no-store"
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
        preferences: defaultPerformancePreferences,
        source: "default"
      },
      { headers: noStoreHeaders }
    );
  }

  const result = await getUserPerformancePreferences(user.id);

  return NextResponse.json(
    {
      authenticated: true,
      ...result
    },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to save performance preferences." }, { status: 401 });
  }

  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return NextResponse.json({ error: "Performance preferences were not valid JSON." }, { status: 400 });
  }

  const preferences = await updateUserPerformancePreferences(user.id, value);

  return NextResponse.json(
    {
      preferences,
      status: "success"
    },
    { headers: noStoreHeaders }
  );
}
