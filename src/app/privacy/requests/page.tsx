import { Database, FileText, ShieldCheck } from "lucide-react";
import { PrivacyRightsForm } from "@/app/privacy/requests/privacy-rights-form";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicSiteSettings } from "@/lib/admin/site-settings-service";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PrivacyRequestsPage() {
  const [siteSettings, user] = await Promise.all([getPublicSiteSettings(), getCurrentUser()]);

  return (
    <PublicShell siteSettings={siteSettings}>
      <main className="border-b border-bc-line bg-bc-void">
        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div>
            <Badge tone="cyan">Privacy rights</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
              Request access, export, correction, deletion, or review of your personal data.
            </h1>
            <p className="mt-4 max-w-2xl text-bc-muted">
              Privacy requests are logged into the admin support inbox with audit tracking so the site operator can verify
              identity and respond consistently.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                <Database className="h-7 w-7 text-bc-electric" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">Covered requests</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  Use this for data access, export, correction, restriction, objection, consent questions, or general privacy
                  queries.
                </p>
              </article>

              <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                <ShieldCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">Verification</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  Staff must verify identity before releasing, exporting, deleting, or changing personal data.
                </p>
              </article>
            </div>

            <div className="mt-8 rounded-md border border-bc-line bg-bc-panel p-5">
              <FileText className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">Need account deletion only?</h2>
              <p className="mt-2 text-sm text-bc-muted">
                A dedicated public account deletion URL is available for app store account deletion requirements.
              </p>
              <div className="mt-4">
                <ButtonLink href="/account/delete" variant="ghost" size="sm">
                  Open account deletion
                </ButtonLink>
              </div>
            </div>
          </div>

          <PrivacyRightsForm defaultEmail={user?.email ?? ""} defaultName={user?.displayName ?? ""} />
        </section>
      </main>
    </PublicShell>
  );
}
