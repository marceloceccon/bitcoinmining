"use client";

import { useMarket } from "@/lib/apiClient";
import { formatNumber, formatUsd } from "@/lib/utils";

const halvingMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** The live market strip. Orange is reserved for live market data; offline data is labelled. */
export default function MarketTicker() {
  const market = useMarket();
  const items: { label: string; value: string; unit?: string; btc?: boolean }[] = [
    { label: "BTC", value: formatUsd(market.btcPriceUsd), btc: true },
    { label: "Hashrate", value: `${formatNumber(market.networkHashrateEh, 0)} EH/s` },
    { label: "Hashprice", value: `$${market.hashpriceUsdPhDay.toFixed(2)}`, unit: "/PH/day" },
    { label: "Fees", value: market.avgFeesPerBlockBtc.toFixed(3), unit: " BTC/block" },
    { label: "Tip", value: formatNumber(market.blockHeight, 0) },
    { label: "Halving", value: `~${halvingMonth(market.nextHalving.estimatedDate)}` },
  ];
  return (
    <div className="ticker">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 font-mono text-xs text-muted">
        {items.map((item) => (
          <span key={item.label} className="whitespace-nowrap">
            {item.label}{" "}
            <b className={item.btc && market.isLive ? "font-medium text-btc" : "font-medium text-fg"}>{item.value}</b>
            {item.unit}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap">
          {market.isLive ? (
            <>
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-btc" aria-hidden />
              live · mempool.space
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-faint" aria-hidden />
              offline estimate · {market.asOf.slice(0, 10)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
