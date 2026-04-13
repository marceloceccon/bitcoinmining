import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SeoContent from "@/components/SeoContent";
import "./globals.css";

const SITE_URL = "https://bitcoinminingfarmcalculator.com";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Bitcoin Mining Farm Calculator — Free CAPEX & ROI Tool",
    template: "%s | Bitcoin Mining Farm Calculator",
  },
  description:
    "Free Bitcoin Mining Farm Calculator: Model full CAPEX/OPEX/ROI for any size ASIC operation. Hardware, taxes, cooling, solar, pool fees & multi-year Stock-to-Flow forecasts. No signup.",
  keywords: [
    "bitcoin mining calculator",
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
    "stock to flow bitcoin price model",
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
      "Free Bitcoin Mining Farm Calculator: Model full CAPEX/OPEX/ROI for any size ASIC operation. Hardware, taxes, cooling, solar, pool fees & multi-year Stock-to-Flow forecasts. No signup.",
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
    url: SITE_URL,
    description:
      "A free, browser-based Bitcoin mining farm calculator. Model ASIC hardware costs, deployment labor, electrical infrastructure, solar offset, cooling sizing, and multi-year profitability forecasts using the Stock-to-Flow model.",
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
      "50+ real ASIC miner database with market pricing",
      "10-component CAPEX breakdown calculator",
      "Multi-year ROI and profitability forecasting",
      "Stock-to-Flow BTC price model integration",
      "Solar power offset modeling",
      "Dry cooler and ventilation fan sizing with ERA5 climate data",
      "Deployment labor and electrical infrastructure estimation",
      "Country-specific import tax calculator",
      "Free API for developers and AI agents",
    ],
  },
  {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is this Bitcoin mining calculator free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. No account, no payment, no trial period. The simulator runs entirely in your browser with no server-side processing of your data.",
        },
      },
      {
        "@type": "Question",
        name: "How accurate are the mining profitability projections?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The projections are estimates based on current network difficulty, the Stock-to-Flow price model, and your input parameters. Real results depend on actual BTC price movement, difficulty changes, hardware reliability, and electricity rate changes. Use this as a planning tool, not a guarantee.",
        },
      },
      {
        "@type": "Question",
        name: "Can I model a large-scale industrial mining farm?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. The simulator supports any farm size from 1 miner to 10,000+. It calculates racks, containers, transformers, cooling, and labor costs that scale with your operation. Most competing calculators only handle single-rig scenarios.",
        },
      },
      {
        "@type": "Question",
        name: "Does this calculator account for Bitcoin halving events?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. The Stock-to-Flow model inherently accounts for halving events in its price projection. The forecast engine also adjusts block reward in revenue calculations when a halving occurs within your projection window.",
        },
      },
      {
        "@type": "Question",
        name: "How is electricity cost modeled?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You set a base electricity rate in dollars per kWh and an annual energy inflation percentage. The forecast engine compounds inflation monthly, giving a realistic cost curve over multi-year horizons. Solar offset reduces the effective grid consumption.",
        },
      },
    ],
  },
  {
    "@type": "Organization",
    name: "Bitcoin Mining Farm Calculator",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
  },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <SeoContent />
        <Analytics />
      </body>
    </html>
  );
}
