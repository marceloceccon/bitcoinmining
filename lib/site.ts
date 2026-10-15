import type { Metadata } from "next";

/** Canonical origin of the production site (D4: www is canonical; next.config.js 308-redirects the apex here). */
export const SITE_URL = "https://www.bitcoinminingfarmcalculator.com";

export const SITE_NAME = "Bitcoin Mining Farm Calculator";

/** Shared social card, rendered by app/opengraph-image.tsx. */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Bitcoin mining farm simulator showing CAPEX calculator, ROI forecast, and farm schematic",
  type: "image/png",
};

/**
 * Canonical, Open Graph and Twitter tags for one page. A page-level `openGraph` replaces the
 * layout's whole object (Next merges metadata shallowly), so every page sets all of it here;
 * otherwise subpages inherit the homepage's og:url and title.
 */
export function pageMetadata({
  path,
  title,
  description,
  socialTitle,
}: {
  path: string;
  /** Omit to use the layout's default title. */
  title?: Metadata["title"];
  description: string;
  /** og:title / twitter:title. */
  socialTitle: string;
}): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: path,
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/** Last real content change per page (ISO date). Feeds the sitemap's lastmod and schema dateModified. */
export const PAGE_UPDATED = {
  "/": "2026-10-15",
  "/methodology": "2026-10-15",
  "/mcp": "2026-10-15",
  "/api-docs": "2026-10-15",
} as const;

/** BreadcrumbList JSON-LD for a page one level below the homepage. */
export function breadcrumbJsonLd(name: string, path: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
}
