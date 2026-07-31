// robots.txt (BUILD-CONTRACT §11 PAGES). Allows crawling of the public read-only
// app; blocks the API and the moderation UI. Points at the generated sitemap.
// Base URL from NEXT_PUBLIC_SITE_URL (via publicEnv).

import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

const SITE_URL = publicEnv.siteUrl.replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
