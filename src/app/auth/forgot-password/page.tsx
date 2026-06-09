import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusMessages: Record<string, string> = {
  accepted: "If that account exists, a password reset email has been sent.",
  sent: "Password reset email sent. Check your inbox.",
  "not-configured": "SMTP is not configured yet, so the reset email could not be sent."
};

const errorMessages: Record<string, string> = {
  "missing-email": "Enter your account email address."
};

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; error?: string; status?: string }>;
}) {
  const { email, error, status } = await searchParams;

  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <section className="w-full rounded-md border border-bc-line bg-bc-panel p-6">
          <div className="flex items-center gap-3">
            <KeyRound className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold uppercase text-bc-electric">Bouncecore account</p>
              <h1 className="mt-1 text-3xl font-black">Reset password</h1>
            </div>
          </div>

          {status ? (
            <div
              className={`mt-5 rounded-md border p-3 text-sm ${
                status === "not-configured"
                  ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                  : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
              }`}
            >
              {statusMessages[status] ?? "Password reset status updated."}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Password reset request failed."}
            </div>
          ) : null}

          <p className="mt-5 text-sm text-bc-muted">
            Enter your account email and Bouncecore will send a one-hour password reset link.
          </p>

          <form action="/api/auth/request-password-reset" className="mt-5 grid gap-3" method="post">
            <label className="text-sm font-semibold" htmlFor="email">
              Email
            </label>
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={email ?? ""}
              id="email"
              name="email"
              required
              type="email"
            />
            <Button type="submit" variant="pink">
              Send reset email
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="muted">Brevo SMTP relay</Badge>
            <Link className="text-sm font-semibold text-bc-electric hover:text-white" href="/auth/login">
              Back to login
            </Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
