import { NextResponse } from "next/server";
import { resendEmailVerification, verificationOrigin, verifyEmailToken } from "@/lib/auth/email-verification-service";
import { appUrl } from "@/lib/http/app-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.redirect(appUrl(request, "/auth/verify-email", { error: "missing-token" }), 303);
  }

  const result = await verifyEmailToken(token);

  if (!result.ok) {
    return NextResponse.redirect(appUrl(request, "/auth/verify-email", { error: "invalid-token" }), 303);
  }

  return NextResponse.redirect(appUrl(request, "/auth/login", { status: "email-verified" }), 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.redirect(appUrl(request, "/auth/verify-email", { error: "missing-email" }), 303);
  }

  const result = await resendEmailVerification(email, verificationOrigin(request));

  return NextResponse.redirect(
    appUrl(request, "/auth/verify-email", {
      email,
      status: result.status
    }),
    303
  );
}
