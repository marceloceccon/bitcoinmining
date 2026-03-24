import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/load"],
      },
    ],
    sitemap: "https://bitcoinminingfarmcalculator.com/sitemap.xml",
  };
}
