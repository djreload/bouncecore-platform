import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { registerUser } from "@/lib/auth/auth-service";
import { formValue, registerSchema } from "@/lib/auth/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = registerSchema.safeParse({
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/auth/register?error=invalid-input", request.url), 303);
  }

  let result;

  try {
    result = await registerUser(parsed.data);
  } catch {
    return NextResponse.redirect(new URL("/auth/register?error=database-unavailable", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(result.redirectTo, request.url), 303);

  if (result.ok) {
    setSessionCookie(response, result.token);
  }

  return response;
}
