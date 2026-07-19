import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/branding/brand-mark";
import { HeaderAjaxCart } from "@/components/cart/header-ajax-cart";
import { SheepThrowOverlay } from "@/components/chat/sheep-throw-overlay";
import { NavList } from "@/components/navigation/nav-list";
import { PublicMobileMenu } from "@/components/navigation/public-mobile-menu";
import { RaveWarChallengeOverlay } from "@/components/rave-wars/rave-war-challenge-overlay";
import { ButtonLink } from "@/components/ui/button";
import { StarSupportOverlay } from "@/app/live/star-support-panel";
import type { PublicChatPresenceUserRow } from "@/app/chat/state";
import type { NavigationItem } from "@/config/navigation";
import { getPublicMenuNavigation, getSiteThemeStyle } from "@/lib/admin/site-design-service";
import { getPublicSiteSettings, type SiteSettings } from "@/lib/admin/site-settings-service";
import type { RoleDisplayNameMap } from "@/lib/auth/role-display";
import { getCurrentUser } from "@/lib/auth/session";
import { accountDeletionHref, privacyRequestsHref } from "@/lib/privacy/privacy-config";

type PublicShellProps = {
  children: React.ReactNode;
  hideFooterOnMobile?: boolean;
  mobilePresenceUsers?: PublicChatPresenceUserRow[];
  roleDisplayLabels?: RoleDisplayNameMap;
  siteSettings?: Pick<SiteSettings, "branding" | "footerSummary" | "legalPages" | "siteName" | "stagingTarget" | "supportEmail">;
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

export async function PublicShell({ children, hideFooterOnMobile = false, mobilePresenceUsers, roleDisplayLabels, siteSettings }: PublicShellProps) {
  const [navigationItems, themeStyle, resolvedSiteSettings, user] = await Promise.all([
    getPublicMenuNavigation(),
    getSiteThemeStyle(),
    siteSettings ? Promise.resolve(siteSettings) : getPublicSiteSettings(),
    getCurrentUser()
  ]);
  const signedIn = Boolean(user);
  const visibleNavigationItems = publicNavigationForAuth(navigationItems, signedIn);
  const siteName = resolvedSiteSettings.siteName ?? "Bouncecore";
  const logoUrl = resolvedSiteSettings.branding?.logoUrl ?? null;
  const footerSummary =
    resolvedSiteSettings.footerSummary ??
    "Bouncecore is the platform shell for livestreams, chatrooms, merch, music, live support, and mobile APIs.";
  const stagingTarget = resolvedSiteSettings.stagingTarget ?? null;
  const legalPages = resolvedSiteSettings.legalPages?.filter((page) => page.enabled) ?? [];
  const supportEmail = resolvedSiteSettings.supportEmail ?? null;

  return (
    <div
      className={`${hideFooterOnMobile ? "h-dvh overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible" : "min-h-screen"} bc-app-shell bg-bc-void text-white`}
      data-bc-public-shell
      data-bc-visual-shell="public"
      style={themeStyle}
    >
      <header className="bc-site-header sticky top-0 z-40 border-b border-bc-line/80 bg-bc-void/90 backdrop-blur" data-bc-visual-part="site-header">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link className="bc-focus-ring flex items-center gap-3 rounded-md" href="/">
            <BrandMark logoUrl={logoUrl} siteName={siteName} />
            <span className="text-lg font-black uppercase">{siteName}</span>
          </Link>
          <div className="hidden flex-1 justify-center lg:flex">
            <NavList items={visibleNavigationItems} orientation="horizontal" />
          </div>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <RaveWarChallengeOverlay />
            <HeaderAjaxCart />
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
            <PublicMobileMenu
              currentUserId={user?.id ?? null}
              isSignedIn={signedIn}
              items={visibleNavigationItems}
              logoUrl={logoUrl}
              mobilePresenceUsers={mobilePresenceUsers}
              roleDisplayLabels={roleDisplayLabels}
              siteName={siteName}
            />
          </div>
        </div>
      </header>
      <StarSupportOverlay />
      <SheepThrowOverlay />
      {children}
      <footer
        className={`${hideFooterOnMobile ? "hidden lg:block" : ""} bc-site-footer border-t border-bc-line bg-bc-ink`}
        data-bc-visual-part="site-footer"
      >
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-bc-muted md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <p>{footerSummary}</p>
            {supportEmail ? (
              <p className="mt-3">
                Support:{" "}
                <a className="bc-focus-ring rounded-sm text-white hover:text-bc-electric" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
              </p>
            ) : null}
          </div>
          <nav aria-label="Legal pages">
            <p className="font-semibold uppercase tracking-[0.08em] text-white">Help</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href="/support">
                Support
              </Link>
              <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href="/mobile">
                Mobile app
              </Link>
              <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href={accountDeletionHref}>
                Account deletion
              </Link>
              <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href={privacyRequestsHref}>
                Privacy requests
              </Link>
              {legalPages.map((page) => (
                <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href={page.href} key={page.key}>
                  {page.title}
                </Link>
              ))}
            </div>
          </nav>
          {stagingTarget ? <p className="md:text-right">Staging target: {stagingTarget}</p> : null}
        </div>
      </footer>
    </div>
  );
}
