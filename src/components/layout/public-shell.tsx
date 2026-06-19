import Link from "next/link";
import { Radio } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavList } from "@/components/navigation/nav-list";
import { PublicMobileMenu } from "@/components/navigation/public-mobile-menu";
import { ButtonLink } from "@/components/ui/button";
import { StarSupportOverlay } from "@/app/live/star-support-panel";
import type { NavigationItem } from "@/config/navigation";
import { getPublicMenuNavigation, getSiteThemeStyle } from "@/lib/admin/site-design-service";
import { getPublicSiteSettings, type SiteSettings } from "@/lib/admin/site-settings-service";
import { getCurrentUser } from "@/lib/auth/session";

type PublicShellProps = {
  children: React.ReactNode;
  hideFooterOnMobile?: boolean;
  siteSettings?: Pick<SiteSettings, "footerSummary" | "siteName" | "stagingTarget">;
};

function publicNavigationForAuth(items: NavigationItem[], signedIn: boolean) {
  return items.filter((item) => {
    if (!signedIn && item.href.startsWith("/account")) {
      return false;
    }

    if (signedIn && (item.href.startsWith("/auth/login") || item.href.startsWith("/auth/register"))) {
      return false;
    }

    return true;
  });
}

export async function PublicShell({ children, hideFooterOnMobile = false, siteSettings }: PublicShellProps) {
  const [navigationItems, themeStyle, resolvedSiteSettings, user] = await Promise.all([
    getPublicMenuNavigation(),
    getSiteThemeStyle(),
    siteSettings ? Promise.resolve(siteSettings) : getPublicSiteSettings(),
    getCurrentUser()
  ]);
  const signedIn = Boolean(user);
  const visibleNavigationItems = publicNavigationForAuth(navigationItems, signedIn);
  const siteName = resolvedSiteSettings.siteName ?? "Bouncecore";
  const footerSummary =
    resolvedSiteSettings.footerSummary ??
    "Bouncecore is the platform shell for livestreams, chatrooms, merch, music, live support, and mobile APIs.";
  const stagingTarget = resolvedSiteSettings.stagingTarget ?? null;

  return (
    <div
      className={`${hideFooterOnMobile ? "h-dvh overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible" : "min-h-screen"} bg-bc-void text-white`}
      style={themeStyle}
    >
      <header className="sticky top-0 z-40 border-b border-bc-line/80 bg-bc-void/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link className="bc-focus-ring flex items-center gap-3 rounded-md" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric shadow-[0_0_26px_rgba(0,213,255,0.22)]">
              <Radio className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black uppercase">{siteName}</span>
          </Link>
          <div className="hidden flex-1 justify-center lg:flex">
            <NavList items={visibleNavigationItems} orientation="horizontal" />
          </div>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {signedIn ? (
              <LogoutButton />
            ) : (
              <>
                <ButtonLink href="/auth/login" variant="ghost" size="sm">
                  Login
                </ButtonLink>
                <ButtonLink href="/auth/register" variant="pink" size="sm">
                  Register
                </ButtonLink>
              </>
            )}
          </div>
          <div className="ml-auto lg:hidden">
            <PublicMobileMenu isSignedIn={signedIn} items={visibleNavigationItems} siteName={siteName} />
          </div>
        </div>
      </header>
      <StarSupportOverlay />
      {children}
      <footer className={`${hideFooterOnMobile ? "hidden lg:block" : ""} border-t border-bc-line bg-bc-ink`}>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-bc-muted md:grid-cols-3">
          <p>{footerSummary}</p>
          <p>Owncast-derived code is reserved for future headless stream-core work only.</p>
          {stagingTarget ? <p className="md:text-right">Staging target: {stagingTarget}</p> : null}
        </div>
      </footer>
    </div>
  );
}
