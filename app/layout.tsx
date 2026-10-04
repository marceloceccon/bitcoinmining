import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import MotionProvider from "@/components/MotionProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "MineForge · Bitcoin Mining Farm Calculator",
  title: {
    default: "Bitcoin Mining Farm Calculator — Free CAPEX & ROI Tool",
    template: "%s | Bitcoin Mining Farm Calculator",
  },
  description:
    "Free Bitcoin Mining Farm Calculator: Model full CAPEX/OPEX/ROI for any size ASIC operation. Hardware, taxes, cooling, solar, pool fees & multi-year forecasts from live network data. No signup.",
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
  authors: [{ name: "Bitcoin Mining Farm Calculator" }],
  creator: "Bitcoin Mining Farm Calculator",
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Bitcoin Mining Farm Calculator",
    title: "Bitcoin Mining Farm Calculator — Free CAPEX & ROI Tool",
    description:
      "Free Bitcoin Mining Farm Calculator: Model full CAPEX/OPEX/ROI for any size ASIC operation. Hardware, taxes, cooling, solar, pool fees & multi-year forecasts from live network data. No signup.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Bitcoin mining farm simulator showing CAPEX calculator, ROI forecast, and farm schematic",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bitcoin Mining Farm Calculator — Free CAPEX & ROI Tool",
    description:
      "Model ASIC costs, deployment labor, cooling, solar offset, and multi-year ROI. Free, private, browser-based.",
    images: ["/opengraph-image"],
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
  alternates: {
    canonical: "/",
  },
  category: "finance",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
  {
    "@type": "SoftwareApplication",
    name: "Bitcoin Mining Farm Calculator",
    alternateName: "MineForge",
    url: SITE_URL,
    description:
      "A free, browser-based Bitcoin mining farm calculator. Model ASIC hardware costs, deployment labor, electrical infrastructure, solar offset, cooling sizing, and multi-year profitability forecasts from live network data with user-chosen BTC price scenarios.",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web Browser",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en",
    isAccessibleForFree: true,
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
      "Country-specific import tax calculator",
      "Free API for developers and AI agents",
    ],
  },
  {
    "@type": "Organization",
    name: "Bitcoin Mining Farm Calculator",
    url: SITE_URL,
    logo: `${SITE_URL}/web-app-manifest-512x512.png`,
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
        <Analytics />
      </body>
    </html>
  );
}
