import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { formValue, registerSchema } from "@/lib/auth/validation";
import { appUrl } from "@/lib/http/app-url";
import { bootstrapOwner } from "@/lib/setup/owner-bootstrap";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = registerSchema.safeParse({
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    inviteToken: undefined,
    password: formValue(formData, "password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(appUrl(request, "/setup/owner", { error: "invalid-input" }), 303);
  }

  let result;

  try {
    result = await bootstrapOwner(parsed.data);
  } catch {
    return NextResponse.redirect(appUrl(request, "/setup/owner", { error: "database-unavailable" }), 303);
  }

  const response = NextResponse.redirect(appUrl(request, result.redirectTo), 303);

  if (result.ok) {
    setSessionCookie(response, result.token);
  }

  return response;
}
