import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import MotionProvider from "@/components/MotionProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "MineForge · Bitcoin Mining Farm Calculator",
  title: {
    default: "Bitcoin Mining Farm Calculator — Profitability, CAPEX & ROI",
    template: "%s | Bitcoin Mining Farm Calculator",
  },
  description:
    "Free Bitcoin mining profitability calculator for farms of any size. Compare ASIC miners, size power and cooling, and forecast CAPEX, OPEX and ROI.",
  keywords: [
    "bitcoin mining calculator",
    "bitcoin mining MCP server",
    "dry cooler sizing bitcoin mining",
    "bitcoin mining profitability calculator",
    "bitcoin mining farm simulator",
    "ASIC miner ROI calculator",
    "bitcoin mining cost calculator",
    "mining farm CAPEX calculator",
    "bitcoin mining investment calculator",
    "bitcoin mining electricity cost",
    "antminer profitability calculator",
    "whatsminer profitability",
    "bitcoin mining solar power",
    "bitcoin mining cooling cost calculator",
    "bitcoin hashprice calculator",
    "mining farm OPEX",
    "bitcoin mining payback period calculator",
    "bitcoin mining farm cost estimator free",
    "industrial bitcoin mining",
    "bitcoin mining farm labor cost estimator",
  ],
  authors: [{ name: "Marcelo Ceccon", url: "https://github.com/marceloceccon" }],
  creator: "Marcelo Ceccon",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  category: "finance",
};

const REPO_URL = "https://github.com/marceloceccon/bitcoinmining";

// Site-wide nodes only (this renders on every page), linked by @id. Page-specific nodes live in the pages.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
  {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "MineForge",
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#org` },
  },
  {
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: SITE_NAME,
    alternateName: "MineForge",
    url: SITE_URL,
    logo: `${SITE_URL}/web-app-manifest-512x512.png`,
    founder: { "@id": `${SITE_URL}/#person` },
    sameAs: [REPO_URL],
  },
  {
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: "Marcelo Ceccon",
    url: "https://github.com/marceloceccon",
    sameAs: ["https://github.com/marceloceccon"],
  },
  {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    alternateName: "MineForge",
    url: SITE_URL,
    description:
      "A free, browser-based Bitcoin mining farm calculator. Model ASIC hardware costs, deployment labor, electrical infrastructure, solar offset, cooling sizing, and multi-year profitability forecasts from live network data with user-chosen BTC price scenarios.",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web Browser",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en",
    isAccessibleForFree: true,
    screenshot: `${SITE_URL}/screenshot.png`,
    author: { "@id": `${SITE_URL}/#person` },
    publisher: { "@id": `${SITE_URL}/#org` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    license: `${REPO_URL}/blob/main/LICENSE`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "90 ASIC models (industrial and home) with sourced, dated prices",
      "Miner comparison at your electricity price",
      "MCP server for AI agents",
      "10-component CAPEX breakdown calculator",
      "Multi-year ROI and profitability forecasting",
      "Live hashrate, fees and halving-aware revenue forecasts",
      "Solar power offset modeling",
      "Dry cooler and ventilation fan sizing with ERA5 climate data",
      "Deployment labor and electrical infrastructure estimation",
      "Per-component import duty rates",
      "Free API for developers and AI agents",
    ],
  },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set by THEME_INIT_SCRIPT before hydration
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <MotionProvider>{children}</MotionProvider>
        {/* Vercel Analytics only exists on Vercel; elsewhere (Cloudflare) its script 404s on every page */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
