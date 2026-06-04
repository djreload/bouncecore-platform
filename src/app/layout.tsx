import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bouncecore Platform",
  description: "All-in-one UK rave livestream, chat, merch, music marketplace, live support, and mobile API platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
