import type { Metadata } from "next";
import { PersistentLiveAudio } from "@/components/live/persistent-live-audio";
import { MobileApkInstallPrompt } from "@/components/mobile/mobile-apk-install-prompt";
import { SitePresenceHeartbeat } from "@/components/presence/site-presence-heartbeat";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import { defaultSiteFaviconUrl, getPublicSiteSettings } from "@/lib/admin/site-settings-service";
import { configuredAppOrigin } from "@/lib/http/app-url";
import "./globals.css";

const defaultShareImageUrl = "/images/bouncecore-stage-hero.png";

function metadataBase() {
  const origin = configuredAppOrigin() ?? "http://localhost:3000";

  return new URL(origin);
}

const fallbackMetadata: Metadata = {
  alternates: {
    canonical: "/"
  },
  description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform.",
  icons: {
    icon: [
      {
        url: defaultSiteFaviconUrl
      }
    ]
  },
  metadataBase: metadataBase(),
  openGraph: {
    description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform.",
    images: [
      {
        url: defaultShareImageUrl
      }
    ],
    siteName: "Bouncecore",
    title: "Bouncecore Platform",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform.",
    images: [defaultShareImageUrl],
    title: "Bouncecore Platform"
  },
  title: "Bouncecore Platform"
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getPublicSiteSettings();
    const shareImageUrl = settings.branding.openGraphImageUrl ?? settings.branding.logoUrl ?? defaultShareImageUrl;

    return {
      alternates: {
        canonical: "/"
      },
      description: settings.homepageIntro,
      icons: {
        icon: [
          {
            url: settings.branding.faviconUrl ?? defaultSiteFaviconUrl
          }
        ]
      },
      metadataBase: metadataBase(),
      openGraph: {
        description: settings.homepageIntro,
        images: [
          {
            alt: `${settings.siteName} share image`,
            url: shareImageUrl
          }
        ],
        siteName: settings.siteName,
        title: settings.siteName,
        type: "website"
      },
      twitter: {
        card: "summary_large_image",
        description: settings.homepageIntro,
        images: [shareImageUrl],
        title: settings.siteName
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
