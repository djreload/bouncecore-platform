import { FileText, LogIn, ShieldCheck } from "lucide-react";
import { PublicAccountDeletionForm } from "@/app/account/delete/public-account-deletion-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicSiteSettings } from "@/lib/admin/site-settings-service";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PublicAccountDeletionPage() {
  const [siteSettings, user] = await Promise.all([getPublicSiteSettings(), getCurrentUser()]);

  return (
    <PublicShell siteSettings={siteSettings}>
      <main className="border-b border-bc-line bg-bc-void">
        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div>
            <Badge tone="pink">Account deletion</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
              Request deletion of a Bouncecore account and related personal data.
            </h1>
            <p className="mt-4 max-w-2xl text-bc-muted">
              This public form is available when you cannot sign in. It sends a tracked request to the site operator for
              verification and deletion review.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                <LogIn className="h-7 w-7 text-bc-electric" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">Can sign in?</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  Signed-in users can delete their own account directly from Account Settings after confirmation.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {user ? (
                    <ButtonLink href="/account/settings#delete-account" variant="ghost" size="sm">
                      Account settings
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/auth/login?next=/account/settings" variant="ghost" size="sm">
                      Login
                    </ButtonLink>
                  )}
                </div>
              </article>

              <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                <ShieldCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">Verification</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  Public requests do not prove ownership by themselves. Staff must verify the request before removing or
                  anonymising data.
                </p>
              </article>
            </div>

            <div className="mt-8 rounded-md border border-bc-line bg-bc-panel p-5">
              <FileText className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">Retention</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Some records may need to be retained for security, fraud prevention, payment, tax, chargeback, or legal
                obligations.
              </p>
            </div>
          </div>

          <PublicAccountDeletionForm defaultEmail={user?.email ?? ""} defaultName={user?.displayName ?? ""} />
        </section>
      </main>
    </PublicShell>
  );
}
