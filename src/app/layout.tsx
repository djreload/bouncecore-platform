import type { Metadata } from "next";
import { PersistentLiveAudio } from "@/components/live/persistent-live-audio";
import { MobileApkInstallPrompt } from "@/components/mobile/mobile-apk-install-prompt";
import { SitePresenceHeartbeat } from "@/components/presence/site-presence-heartbeat";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import { defaultSiteFaviconUrl, getPublicSiteSettings } from "@/lib/admin/site-settings-service";
import "./globals.css";

const fallbackMetadata: Metadata = {
  description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform.",
  icons: {
    icon: [
      {
        url: defaultSiteFaviconUrl
      }
    ]
  },
  title: "Bouncecore Platform"
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getPublicSiteSettings();

    return {
      description: settings.homepageIntro,
      icons: {
        icon: [
          {
            url: settings.branding.faviconUrl ?? defaultSiteFaviconUrl
          }
        ]
      },
      title: settings.siteName
    };
  } catch {
    return fallbackMetadata;
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PersistentLiveAudio />
        <SitePresenceHeartbeat />
        <CookieConsentManager />
        <MobileApkInstallPrompt />
      </body>
    </html>
  );
}
