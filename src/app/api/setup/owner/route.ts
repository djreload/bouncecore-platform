import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { formValue, registerSchema } from "@/lib/auth/validation";
import { bootstrapOwner } from "@/lib/setup/owner-bootstrap";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = registerSchema.safeParse({
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/setup/owner?error=invalid-input", request.url), 303);
  }

  let result;

  try {
    result = await bootstrapOwner(parsed.data);
  } catch {
    return NextResponse.redirect(new URL("/setup/owner?error=database-unavailable", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(result.redirectTo, request.url), 303);

  if (result.ok) {
    setSessionCookie(response, result.token);
  }

  return response;
}
