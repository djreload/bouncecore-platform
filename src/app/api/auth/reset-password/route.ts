import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth/email-verification-service";
import { appUrl } from "@/lib/http/app-url";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = formString(formData, "token");
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!token) {
    return NextResponse.redirect(appUrl(request, "/auth/reset-password", { error: "missing-token" }), 303);
  }

  if (password !== confirmPassword) {
    return NextResponse.redirect(appUrl(request, "/auth/reset-password", { error: "password-mismatch", token }), 303);
  }

  const result = await resetPasswordWithToken(token, password);

  if (!result.ok) {
    return NextResponse.redirect(appUrl(request, "/auth/reset-password", { error: result.status, token }), 303);
  }

  return NextResponse.redirect(appUrl(request, "/auth/login", { status: "password-reset" }), 303);
}
