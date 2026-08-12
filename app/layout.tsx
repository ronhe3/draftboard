import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Draftboard — Fantasy Football Rankings",
  description: "Clear, current fantasy football rankings built for draft day decisions.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Draftboard — Know who's next.",
    description: "2026 fantasy football rankings built for draft day decisions.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Draftboard fantasy football rankings" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
