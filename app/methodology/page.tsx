import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SeoContent from "@/components/SeoContent";
import { FAQ_JSON_LD } from "@/lib/faqJsonLd";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How MineForge models a Bitcoin mining farm: power and transformer sizing, climate-derated cooling, itemized CAPEX and OPEX, live-network revenue with fees and halvings by block height, and user-chosen BTC price scenarios.",
  alternates: { canonical: "/methodology" },
};

const ENDPOINTS = [
  ["POST /api/calculate", "CAPEX, OPEX, cooling and spot revenue for a farm config"],
  ["POST /api/forecast", "Multi-year forecast with price scenarios and the assumptions used"],
  ["GET /api/miners", "The ASIC catalog with specs, prices and their sources"],
  ["GET /api/network", "Live BTC price, hashrate, tip height, fees and hashprice"],
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        <header className="space-y-3">
          <p className="label">Methodology</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">How MineForge works</h1>
          <p className="max-w-2xl text-fg-2">
            MineForge is a free planning tool for Bitcoin mining operations, from a single home unit to an industrial
            farm. It models hardware, deployment labor, electrical infrastructure, cooling at your site&apos;s climate,
            solar offset and multi-year cash flow from live network data. Built by Marcelo Ceccon. Every formula is
            documented in{" "}
            <a href="https://github.com/marceloceccon/bitcoinmining/blob/main/ARCHITECTURE.md" className="text-fg underline underline-offset-2">
              ARCHITECTURE.md
            </a>
            .
          </p>
        </header>

        <section className="panel space-y-4 p-6" aria-labelledby="api">
          <h2 id="api" className="text-lg font-semibold text-fg">Free API for developers and AI agents</h2>
          <p className="text-sm text-fg-2">
            The REST API runs the same engine as this site. Market inputs are filled from the live snapshot unless you
            pin them, and every response echoes the assumptions it used.
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {ENDPOINTS.map(([path, desc]) => (
              <div key={path} className="inset p-3">
                <dt className="font-mono text-xs font-semibold text-fg">{path}</dt>
                <dd className="mt-1 text-xs text-muted">{desc}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">
            60 requests per minute per IP for external callers (best-effort), no API key, CORS enabled. Spec:{" "}
            <code className="font-mono">/openapi.json</code> ·{" "}
            <Link href="/api-docs" className="text-fg underline underline-offset-2">API documentation</Link>
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="panel p-6">
            <h2 className="mb-2 text-lg font-semibold text-fg">Privacy</h2>
            <p className="text-sm text-fg-2">
              No accounts. No cookies. Anonymous page analytics only. Calculations run in your browser; the only request
              is for live market data, and your farm configuration is never sent or stored.
            </p>
          </div>
          <div className="panel p-6">
            <h2 className="mb-2 text-lg font-semibold text-fg">Open source</h2>
            <p className="text-sm text-fg-2">
              MIT-licensed on{" "}
              <a href="https://github.com/marceloceccon/bitcoinmining" className="text-fg underline underline-offset-2">GitHub</a>.
              Anyone can contribute, fork it, maintain the miner database, or host their own instance.
            </p>
          </div>
        </section>

        <section className="note-warn space-y-2 rounded p-6 text-sm text-fg-2">
          <h2 className="text-lg font-semibold text-fg">Disclaimer</h2>
          <p>
            Provided as-is for informational and educational purposes. All figures are estimates, not financial,
            investment or engineering advice. Prices, availability, difficulty and electricity costs change constantly:
            verify with real supplier quotes and a licensed electrician before committing capital.
          </p>
        </section>

        <SeoContent />
      </main>
      <SiteFooter />
    </div>
  );
}
