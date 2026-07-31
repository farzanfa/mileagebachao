// sitemap.xml (BUILD-CONTRACT §11 PAGES). Built from the seed dataset via
// @/lib/data (NO DB) and NEXT_PUBLIC_SITE_URL. Lists the landing, map, content
// pages, every city page and every station detail page.

import type { MetadataRoute } from "next";

import { allStations, cities } from "@/lib/data";
import { publicEnv } from "@/lib/env";

const SITE_URL = publicEnv.siteUrl.replace(/\/+$/, "");

function stationDate(lastVerified: string | null, firstSeen: string): Date {
  const raw = lastVerified ?? firstSeen;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const stations = allStations();
  const cityList = cities();

  // Latest known date per city (for the city page lastModified).
  const cityLatest = new Map<string, number>();
  for (const s of stations) {
    const t = stationDate(s.lastVerified, s.firstSeen).getTime();
    const prev = cityLatest.get(s.citySlug) ?? 0;
    if (t > prev) cityLatest.set(s.citySlug, t);
  }

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/map`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/attribution`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const cityPages: MetadataRoute.Sitemap = cityList.map((c) => ({
    url: `${SITE_URL}/${c.slug}`,
    lastModified: new Date(cityLatest.get(c.slug) ?? now.getTime()),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const stationPages: MetadataRoute.Sitemap = stations.map((s) => ({
    url: `${SITE_URL}/station/${s.slug}`,
    lastModified: stationDate(s.lastVerified, s.firstSeen),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...cityPages, ...stationPages];
}
