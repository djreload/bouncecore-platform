import Link from "next/link";
import { MailCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const statusMessages: Record<string, string> = {
  accepted: "If that account needs verification, a new email has been sent.",
  sent: "Verification email sent. Check your inbox.",
  "not-configured": "Account created, but SMTP is not configured yet. Add Brevo SMTP details and resend this email."
};

const errorMessages: Record<string, string> = {
  "email-unverified": "Verify your email before logging in.",
  "invalid-token": "That verification link is invalid, expired, or already used.",
  "missing-email": "Enter your email address to resend verification.",
  "missing-token": "The verification link is missing its token."
};

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
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
            <MailCheck className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold uppercase text-bc-electric">Bouncecore account</p>
              <h1 className="mt-1 text-3xl font-black">Verify email</h1>
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
              {statusMessages[status] ?? "Verification status updated."}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Email verification failed."}
            </div>
          ) : null}

          <p className="mt-5 text-sm text-bc-muted">
            Open the verification link from your inbox. The link expires after 24 hours.
          </p>

          <form action="/api/auth/verify-email" className="mt-5 grid gap-3" method="post">
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
              Resend verification
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
