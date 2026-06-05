import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const errorMessages: Record<string, string> = {
  "invalid-input": "Check your email and password, then try again.",
  "invalid-credentials": "Those login details did not match a Bouncecore account.",
  "account-disabled": "This account cannot sign in right now.",
  "database-unavailable": "The Bouncecore database is not connected yet."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error, status } = await searchParams;

  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <form action="/api/auth/login" className="w-full rounded-md border border-bc-line bg-bc-panel p-6" method="post">
          <p className="text-sm font-semibold uppercase text-bc-electric">Bouncecore account</p>
          <h1 className="mt-2 text-3xl font-black">Login</h1>
          {status === "signed-out" ? (
            <div className="mt-5 rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3 text-sm text-bc-acid">
              You have been signed out.
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Login failed. Try again."}
            </div>
          ) : null}
          <label className="mt-6 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="email" name="email" required type="email" />
          <label className="mt-4 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="password" name="password" required type="password" />
          <Button className="mt-6 w-full" type="submit">
            Login
          </Button>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="muted">HTTP-only session cookie</Badge>
            <Badge tone="muted">Audit-ready</Badge>
          </div>
        </form>
      </main>
    </PublicShell>
  );
}
