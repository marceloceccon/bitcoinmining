import type { MetadataRoute } from "next";
import { PAGE_UPDATED, SITE_URL } from "@/lib/site";
import updates from "@/data/updates.json";

/**
 * lastmod must change only when the page does, or Google ignores it. Bump PAGE_UPDATED (lib/site.ts)
 * when a page's copy changes; the homepage also moves with the miner catalog, whichever is later.
 */
const latest = (...dates: string[]) => new Date(Math.max(...dates.map((d) => Date.parse(d))));

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(PAGE_UPDATED).map(([path, updated]) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    lastModified: path === "/" ? latest(updated, updates.miners.lastUpdated) : new Date(updated),
  }));
}
