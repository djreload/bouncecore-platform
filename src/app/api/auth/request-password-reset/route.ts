import { NextResponse } from "next/server";
import { requestPasswordReset, verificationOrigin } from "@/lib/auth/email-verification-service";
import { appUrl } from "@/lib/http/app-url";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.redirect(appUrl(request, "/auth/forgot-password", { error: "missing-email" }), 303);
  }

  const result = await requestPasswordReset(email, verificationOrigin(request));

  return NextResponse.redirect(
    appUrl(request, "/auth/forgot-password", {
      email,
      status: result.status
    }),
    303
  );
}
