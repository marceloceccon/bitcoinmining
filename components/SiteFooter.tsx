import Link from "next/link";
import { hardwarePricesAsOf } from "@/lib/catalog";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-3 px-4 py-8 text-sm text-muted sm:flex sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-fg">MineForge · Bitcoin Mining Farm Calculator</p>
          <p>Simulation tool only. Not financial or engineering advice.</p>
          <p>
            Hardware prices as of {hardwarePricesAsOf()} · live market data from mempool.space · built by Marcelo Ceccon
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/methodology" className="hover:text-fg">Methodology</Link>
          <Link href="/api-docs" className="hover:text-fg">Free API</Link>
          <a href="https://github.com/marceloceccon/bitcoinmining" className="hover:text-fg">GitHub</a>
          <span className="font-mono text-xs text-faint">
            {process.env.NEXT_PUBLIC_COMMIT_HASH ?? "dev"} · {process.env.NEXT_PUBLIC_COMMIT_DATE ?? ""}
          </span>
        </div>
      </div>
    </footer>
  );
}
