import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { publicEnv } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

// Set the persisted theme before first paint to avoid a flash of the wrong theme.
// Reads localStorage("theme"); ThemeToggle (UICORE) writes it and stamps data-theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: `${SITE_NAME} — Ethanol-free (E0) & 100-octane petrol in India`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "ethanol-free petrol",
    "E0 fuel",
    "100 octane",
    "XP100",
    "poWer 100",
    "Speed 100",
    "premium petrol India",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: publicEnv.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1316" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
