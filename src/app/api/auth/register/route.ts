import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { registerUser } from "@/lib/auth/auth-service";
import { formValue, registerSchema } from "@/lib/auth/validation";
import { appOrigin, appUrl } from "@/lib/http/app-url";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = registerSchema.safeParse({
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    inviteToken: formValue(formData, "inviteToken") || undefined,
    password: formValue(formData, "password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(appUrl(request, "/auth/register", { error: "invalid-input" }), 303);
  }

  let result;

  try {
    result = await registerUser({
      ...parsed.data,
      origin: appOrigin(request)
    });
  } catch {
    return NextResponse.redirect(appUrl(request, "/auth/register", { error: "database-unavailable" }), 303);
  }

  const response = NextResponse.redirect(appUrl(request, result.redirectTo), 303);

  if (result.ok) {
    setSessionCookie(response, result.token);
  }

  return response;
}
