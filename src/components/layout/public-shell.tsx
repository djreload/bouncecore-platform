import Link from "next/link";
import { Radio } from "lucide-react";
import { publicNavigation } from "@/config/navigation";
import { NavList } from "@/components/navigation/nav-list";
import { ButtonLink } from "@/components/ui/button";
import { StarSupportOverlay } from "@/app/live/star-support-panel";
import type { SiteSettings } from "@/lib/admin/site-settings-service";

type PublicShellProps = {
  children: React.ReactNode;
  siteSettings?: Pick<SiteSettings, "footerSummary" | "siteName" | "stagingTarget">;
};

export function PublicShell({ children, siteSettings }: PublicShellProps) {
  const siteName = siteSettings?.siteName ?? "Bouncecore";
  const footerSummary =
    siteSettings?.footerSummary ??
    "Bouncecore is the platform shell for livestreams, chatrooms, merch, music, live support, and mobile APIs.";
  const stagingTarget = siteSettings?.stagingTarget ?? "develop.k-nrg.co.uk";

  return (
    <div className="min-h-screen bg-bc-void text-white">
      <header className="sticky top-0 z-40 border-b border-bc-line/80 bg-bc-void/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link className="bc-focus-ring flex items-center gap-3 rounded-md" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric shadow-[0_0_26px_rgba(0,213,255,0.22)]">
              <Radio className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black uppercase">{siteName}</span>
          </Link>
          <div className="hidden flex-1 justify-center lg:flex">
            <NavList items={publicNavigation} orientation="horizontal" />
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <ButtonLink href="/auth/login" variant="ghost" size="sm">
              Login
            </ButtonLink>
            <ButtonLink href="/auth/register" variant="pink" size="sm">
              Register
            </ButtonLink>
          </div>
        </div>
        <div className="border-t border-bc-line/60 px-4 py-2 lg:hidden">
          <NavList items={publicNavigation} orientation="horizontal" />
        </div>
      </header>
      <StarSupportOverlay />
      {children}
      <footer className="border-t border-bc-line bg-bc-ink">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-bc-muted md:grid-cols-3">
          <p>{footerSummary}</p>
          <p>Owncast-derived code is reserved for future headless stream-core work only.</p>
          {stagingTarget ? <p className="md:text-right">Staging target: {stagingTarget}</p> : null}
        </div>
      </footer>
    </div>
  );
}
