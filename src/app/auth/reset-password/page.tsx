import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  "invalid-input": "Use a password of at least 12 characters.",
  "invalid-token": "That reset link is invalid, expired, or already used.",
  "missing-token": "The reset link is missing its token.",
  "password-mismatch": "The password confirmation does not match."
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const { error, token } = await searchParams;

  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <section className="w-full rounded-md border border-bc-line bg-bc-panel p-6">
          <div className="flex items-center gap-3">
            <LockKeyhole className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold uppercase text-bc-electric">Bouncecore account</p>
              <h1 className="mt-1 text-3xl font-black">Set new password</h1>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Password reset failed."}
            </div>
          ) : null}

          {token ? (
            <form action="/api/auth/reset-password" className="mt-5 grid gap-3" method="post">
              <input name="token" type="hidden" value={token} />
              <label className="text-sm font-semibold" htmlFor="password">
                New password
              </label>
              <input
                className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                id="password"
                minLength={12}
                name="password"
                required
                type="password"
              />
              <label className="text-sm font-semibold" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                id="confirm-password"
                minLength={12}
                name="confirmPassword"
                required
                type="password"
              />
              <Button type="submit" variant="pink">
                Save password
              </Button>
            </form>
          ) : (
            <p className="mt-5 text-sm text-bc-muted">Request a new password reset email to receive a valid reset link.</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="muted">One-hour reset token</Badge>
            <Link className="text-sm font-semibold text-bc-electric hover:text-white" href="/auth/forgot-password">
              Request new link
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
