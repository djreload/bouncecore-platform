import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/auth-service";
import { setSessionCookie } from "@/lib/auth/cookies";
import { formValue, loginSchema } from "@/lib/auth/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid-input", request.url), 303);
  }

  let result;

  try {
    result = await loginUser(parsed.data);
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=database-unavailable", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(result.redirectTo, request.url), 303);

  if (result.ok) {
    setSessionCookie(response, result.token);
  }

  return response;
}
