import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api-docs"],
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://bitcoinminingfarmcalculator.com/sitemap.xml",
  };
}
