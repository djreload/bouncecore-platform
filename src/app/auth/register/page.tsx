import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { roleDisplayName } from "@/lib/auth/role-display";
import { getRegisterInvitePreview } from "@/lib/auth/user-invite-service";

const errorMessages: Record<string, string> = {
  "invalid-input": "Use a valid email, display name, and password of at least 12 characters.",
  "invalid-invite": "That invite link is invalid, expired, revoked, or already used.",
  "invite-email-mismatch": "That invite is locked to a different email address.",
  "email-in-use": "That email is already registered.",
  "database-unavailable": "The Bouncecore database is not connected yet."
};

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;
  const invitePreview = await getRegisterInvitePreview(invite);

  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <form action="/api/auth/register" className="w-full rounded-md border border-bc-line bg-bc-panel p-6" method="post">
          <p className="text-sm font-semibold uppercase text-bc-pink">Join Bouncecore</p>
          <h1 className="mt-2 text-3xl font-black">Register</h1>
          {invite ? <input name="inviteToken" type="hidden" value={invite} /> : null}
          {error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages[error] ?? "Registration failed. Try again."}
            </div>
          ) : null}
          {invite && !invitePreview && !error ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
              {errorMessages["invalid-invite"]}
            </div>
          ) : null}
          {invitePreview ? (
            <div className="mt-5 rounded-md border border-bc-electric/30 bg-bc-electric/10 p-3 text-sm text-bc-electric">
              Invite for {invitePreview.email}
            </div>
          ) : null}
          <label className="mt-6 block text-sm font-semibold" htmlFor="name">
            Display name
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="name" name="displayName" required />
          <label className="mt-4 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input
            className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2"
            defaultValue={invitePreview?.email}
            id="email"
            name="email"
            readOnly={Boolean(invitePreview)}
            required
            type="email"
          />
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
            {invitePreview ? (
              invitePreview.roles.map((role) => (
                <Badge key={role} tone="muted">
                  {roleDisplayName(role)}
                </Badge>
              ))
            ) : (
              <Badge tone="muted">Viewer role by default</Badge>
            )}
            <Badge tone="muted">12+ character password</Badge>
          </div>
        </form>
      </main>
    </PublicShell>
  );
}
