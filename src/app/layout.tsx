import type { Metadata } from "next";
import { PersistentLiveAudio } from "@/components/live/persistent-live-audio";
import { CookieConsentManager } from "@/components/privacy/cookie-consent-manager";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bouncecore Platform",
  description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PersistentLiveAudio />
        <CookieConsentManager />
      </body>
    </html>
  );
}
