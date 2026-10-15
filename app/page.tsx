import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MarketTicker from "@/components/MarketTicker";
import Calculator from "@/components/Calculator";
import Faq from "@/components/Faq";
import { pageMetadata } from "@/lib/site";

// The <title> is the layout's default; only the social title needs spelling out.
export const metadata: Metadata = pageMetadata({
  path: "/",
  socialTitle: "Bitcoin Mining Farm Calculator — Profitability, CAPEX & ROI",
  description:
    "Free Bitcoin mining profitability calculator for farms of any size. Compare ASIC miners, size power and cooling, and forecast CAPEX, OPEX and ROI.",
});

export default function Home() {
  return (
    <div className="min-h-screen">
      <MarketTicker />
      <SiteHeader />
      <main>
        <Calculator />

        {/* Slim methodology summary; the full version lives at /methodology */}
        <section aria-labelledby="how-it-works" className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 border-t border-line pt-10 md:grid-cols-[1fr_2fr]">
            <h2 id="how-it-works" className="text-xl font-semibold text-fg">
              How the numbers are made
            </h2>
            <div className="grid gap-4 text-sm leading-relaxed text-fg-2 sm:grid-cols-3">
              <p>
                <b className="block text-fg">Engineered, not estimated.</b>
                Miner count sets power and transformer kVA; the site&apos;s climate derates dry coolers and sets fan
                airflow; every line of CAPEX and OPEX is itemized.
              </p>
              <p>
                <b className="block text-fg">Live network data.</b>
                Revenue is your share of the live network hashrate times the block subsidy plus fees. Halvings come
                from block height; the BTC price is a scenario you choose.
              </p>
              <p>
                <b className="block text-fg">One tested engine.</b>
                The browser, the free REST API and AI agents all use the same engine, covered by golden fixtures.{" "}
                <Link href="/methodology" className="text-fg underline underline-offset-2">
                  Read the methodology
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
