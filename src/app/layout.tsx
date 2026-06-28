import type { Metadata } from "next";
import { PersistentLiveAudio } from "@/components/live/persistent-live-audio";
import { SitePresenceHeartbeat } from "@/components/presence/site-presence-heartbeat";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import { getPublicSiteSettings } from "@/lib/admin/site-settings-service";
import "./globals.css";

const fallbackMetadata: Metadata = {
  title: "Bouncecore Platform",
  description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform."
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getPublicSiteSettings();

    return {
      description: settings.homepageIntro,
      icons: settings.branding.faviconUrl
        ? {
            icon: [
              {
                url: settings.branding.faviconUrl
              }
            ]
          }
        : undefined,
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
      </body>
    </html>
  );
}
