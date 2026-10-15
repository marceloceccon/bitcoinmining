import type { MetadataRoute } from "next";
import { PAGE_UPDATED, SITE_URL } from "@/lib/site";
import updates from "@/data/updates.json";

/**
 * lastmod must change only when the page does, or Google ignores it. The homepage moves with the
 * miner catalog; bump PAGE_UPDATED (lib/site.ts) when a subpage's copy changes.
 */
const PAGES: { path: string; lastModified: string }[] = [
  { path: "", lastModified: updates.miners.lastUpdated },
  ...Object.entries(PAGE_UPDATED).map(([path, lastModified]) => ({ path, lastModified })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, lastModified }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(lastModified),
  }));
}
