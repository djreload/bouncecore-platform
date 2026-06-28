import { Headphones, Mail, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicSiteSettings } from "@/lib/admin/site-settings-service";
import { getCurrentUser } from "@/lib/auth/session";
import { SupportForm } from "@/app/support/support-form";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const [siteSettings, user] = await Promise.all([getPublicSiteSettings(), getCurrentUser()]);

  return (
    <PublicShell siteSettings={siteSettings}>
      <main className="border-b border-bc-line bg-bc-void">
        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div>
            <Badge tone="cyan">Help desk</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">Support for accounts, streams, orders, chat, music, and the mobile app.</h1>
            <p className="mt-4 max-w-2xl text-bc-muted">
              Requests are logged into the admin support inbox with status tracking and an audit trail, so owners and admins can
              pick them up without losing context.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                <Mail className="h-7 w-7 text-bc-electric" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">Direct email</h2>
                {siteSettings.supportEmail ? (
                  <a className="mt-2 block break-all text-sm text-bc-electric hover:text-white" href={`mailto:${siteSettings.supportEmail}`}>
                    {siteSettings.supportEmail}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-bc-muted">Set a support email in Admin settings.</p>
                )}
              </article>
              <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                <ShieldCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-black">Account context</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  {user ? "Your signed-in account will be attached to this request." : "Signed-in users can include account context automatically."}
                </p>
                {!user ? (
                  <div className="mt-4">
                    <ButtonLink href="/auth/login" variant="ghost" size="sm">
                      Login
                    </ButtonLink>
                  </div>
                ) : null}
              </article>
            </div>

            <div className="mt-8 rounded-md border border-bc-line bg-bc-panel p-5">
              <Headphones className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">What to include</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Include usernames, order references, stream times, track names, screenshots, device details, or exact error text
                when relevant.
              </p>
            </div>
          </div>

          <SupportForm defaultEmail={user?.email ?? ""} defaultName={user?.displayName ?? ""} />
        </section>
      </main>
    </PublicShell>
  );
}
