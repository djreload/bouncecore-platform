import { ShieldCheck, Wrench } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOwnerSetupStatus } from "@/lib/setup/owner-bootstrap";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  "invalid-input": "Use a valid email, display name, and password of at least 12 characters.",
  "owner-exists": "An Owner account already exists. Use the normal login flow.",
  "database-unavailable": "The Bouncecore database is not connected yet."
};

export default async function OwnerSetupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, status] = await Promise.all([searchParams, getOwnerSetupStatus()]);
  const disabled = !status.databaseAvailable || status.ownerExists;

  return (
    <PublicShell>
      <main className="mx-auto grid min-h-[72vh] max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_420px]">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="pink">Owner bootstrap</Badge>
          <h1 className="mt-4 text-4xl font-black">Create the first Bouncecore Owner</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            This setup route seeds roles and permissions, creates the first Owner account, starts a secure session, and
            then closes itself once an Owner exists.
          </p>

          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Owner setup failed. Try again."}
            </div>
          ) : null}

          {!status.databaseAvailable ? (
            <div className="mt-5 rounded-md border border-bc-amber/30 bg-bc-amber/10 p-3 text-sm text-bc-amber">
              {status.message}
            </div>
          ) : null}

          {status.ownerExists ? (
            <div className="mt-5 rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3 text-sm text-bc-acid">
              Owner setup is locked because an Owner role assignment already exists.
            </div>
          ) : null}
        </section>

        <form action="/api/setup/owner" className="rounded-md border border-bc-line bg-bc-panel p-6" method="post">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-black">Owner account</h2>
              <p className="text-sm text-bc-muted">Available once PostgreSQL is migrated.</p>
            </div>
          </div>

          <label className="mt-6 block text-sm font-semibold" htmlFor="displayName">
            Display name
          </label>
          <input
            className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 disabled:opacity-60"
            disabled={disabled}
            id="displayName"
            name="displayName"
            required
          />

          <label className="mt-4 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 disabled:opacity-60"
            disabled={disabled}
            id="email"
            name="email"
            required
            type="email"
          />

          <label className="mt-4 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 disabled:opacity-60"
            disabled={disabled}
            id="password"
            minLength={12}
            name="password"
            required
            type="password"
          />

          <Button className="mt-6 w-full" disabled={disabled} type="submit" variant="pink">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Create Owner
          </Button>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="rounded-md border border-bc-line bg-bc-ink p-3">
              <dt className="font-semibold">Database</dt>
              <dd className="mt-1 text-bc-muted">{status.databaseAvailable ? "Reachable" : "Unavailable"}</dd>
            </div>
            <div className="rounded-md border border-bc-line bg-bc-ink p-3">
              <dt className="font-semibold">Users</dt>
              <dd className="mt-1 text-bc-muted">{status.userCount ?? "Not checked"}</dd>
            </div>
          </dl>
        </form>
      </main>
    </PublicShell>
  );
}
