import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const errorMessages: Record<string, string> = {
  "invalid-input": "Use a valid email, display name, and password of at least 12 characters.",
  "email-in-use": "That email is already registered.",
  "database-unavailable": "The Bouncecore database is not connected yet."
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <form action="/api/auth/register" className="w-full rounded-md border border-bc-line bg-bc-panel p-6" method="post">
          <p className="text-sm font-semibold uppercase text-bc-pink">Join Bouncecore</p>
          <h1 className="mt-2 text-3xl font-black">Register</h1>
          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Registration failed. Try again."}
            </div>
          ) : null}
          <label className="mt-6 block text-sm font-semibold" htmlFor="name">
            Display name
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="name" name="displayName" required />
          <label className="mt-4 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="email" name="email" required type="email" />
          <label className="mt-4 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2"
            id="password"
            minLength={12}
            name="password"
            required
            type="password"
          />
          <Button className="mt-6 w-full" type="submit" variant="pink">
            Register
          </Button>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="muted">Viewer role by default</Badge>
            <Badge tone="muted">12+ character password</Badge>
          </div>
        </form>
      </main>
    </PublicShell>
  );
}
