"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useFarmStore } from "@/lib/store";
import { useMarket, useMiners } from "@/lib/apiClient";
import { hardwarePricesAsOf } from "@/lib/catalog";
import { minerEconomics, type MinerEconomics } from "@/lib/unitEconomics";
import { formatUsd } from "@/lib/utils";
import type { CatalogMiner, MinerCooling, MinerSegment } from "@/types";

type SortKey = "name" | "efficiency_jth" | "profitPerDayUsd" | "revenuePerDayUsd" | "powerCostPerDayUsd" | "breakEvenKwh" | "usdPerTh" | "paybackDays";
type Row = CatalogMiner & MinerEconomics;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Miner", numeric: false },
  { key: "efficiency_jth", label: "J/TH", numeric: true },
  { key: "revenuePerDayUsd", label: "Revenue/day", numeric: true },
  { key: "powerCostPerDayUsd", label: "Power/day", numeric: true },
  { key: "profitPerDayUsd", label: "Profit/day", numeric: true },
  { key: "breakEvenKwh", label: "Break-even $/kWh", numeric: true },
  { key: "usdPerTh", label: "$/TH", numeric: true },
  { key: "paybackDays", label: "Payback", numeric: true },
];

const usd2 = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;

/**
 * Every miner's daily economics at *your* power price and today's market:
 * revenue, power cost and profit per day, the power price at which it breaks
 * even, $/TH and simple payback. Same math as the API/MCP compare_miners.
 */
export default function MinerComparison() {
  const { miners } = useMiners();
  const market = useMarket();
  const config = useFarmStore((s) => s.config);
  const addMiner = useFarmStore((s) => s.addMiner);
  const updateMinerQuantity = useFarmStore((s) => s.updateMinerQuantity);
  const add = (miner: CatalogMiner) => {
    const existing = config.miners.find((m) => m.miner.id === miner.id);
    if (existing) updateMinerQuantity(miner.id, existing.quantity + 1);
    else addMiner({ miner, quantity: 1 });
  };
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "profitPerDayUsd", dir: "desc" });
  const [segment, setSegment] = useState<MinerSegment | "all">("all");
  const [cooling, setCooling] = useState<MinerCooling | "all">("all");
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [includeAnnounced, setIncludeAnnounced] = useState(false);

  const price = config.regional.electricityPriceKwh * (1 + config.regional.taxAdderPercent / 100);

  const rows = useMemo(() => {
    const input = { electricityPriceKwh: price, uptimePercent: config.uptimePercent, poolFeePercent: config.poolFeePercent };
    const list: Row[] = miners
      .filter((m) => (includeLegacy || m.status !== "legacy") && (includeAnnounced || m.status !== "announced"))
      .filter((m) => (segment === "all" || m.segment === segment) && (cooling === "all" || m.cooling === cooling))
      .map((m) => ({ ...m, ...minerEconomics(m, market, input) }));
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      // Rows without a payback always sort last
      if (av === null) return 1;
      if (bv === null) return -1;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [miners, market, price, config.uptimePercent, config.poolFeePercent, segment, cooling, includeLegacy, includeAnnounced, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "efficiency_jth" || key === "usdPerTh" || key === "paybackDays" ? "asc" : "desc" }));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-fg">Compare miners</h2>
          <p className="text-sm text-muted">
            At ${price.toFixed(3)}/kWh, {config.uptimePercent}% uptime, {config.poolFeePercent}% pool fee and today&apos;s
            market ({market.isLive ? "live" : "offline estimate"}). Wall power only. Prices as of {hardwarePricesAsOf()}.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "industrial", "home"] as const).map((s) => (
          <Button key={s} size="sm" variant={segment === s ? "primary" : "default"} aria-pressed={segment === s} onClick={() => setSegment(s)}>
            {s === "all" ? "All segments" : s[0].toUpperCase() + s.slice(1)}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        {(["all", "air", "hydro", "immersion"] as const).map((c) => (
          <Button key={c} size="sm" variant={cooling === c ? "primary" : "default"} aria-pressed={cooling === c} onClick={() => setCooling(c)}>
            {c === "all" ? "Any cooling" : c[0].toUpperCase() + c.slice(1)}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={includeLegacy} onChange={(e) => setIncludeLegacy(e.target.checked)} />
          Legacy
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={includeAnnounced} onChange={(e) => setIncludeAnnounced(e.target.checked)} />
          Announced
        </label>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded border border-line">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">Miner economics, sorted by {COLUMNS.find((c) => c.key === sort.key)?.label}</caption>
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="border-b border-line">
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-2 font-medium text-muted ${c.numeric ? "text-right" : "text-left"}`}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-fg">
                    {c.label}
                    {sort.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-3 py-2"><span className="sr-only">Add</span></th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <th scope="row" className="px-3 py-2 text-left font-sans text-sm font-medium text-fg">
                  {r.name}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-faint">
                    {[r.cooling !== "air" && r.cooling, r.status !== "current" && r.status, r.segment === "home" && "home"].filter(Boolean).join(" · ")}
                  </span>
                </th>
                <td className="px-3 py-2 text-right text-fg-2">{r.efficiency_jth.toFixed(1)}</td>
                <td className="px-3 py-2 text-right text-fg-2">{usd2(r.revenuePerDayUsd)}</td>
                <td className="px-3 py-2 text-right text-fg-2">{usd2(r.powerCostPerDayUsd)}</td>
                <td className={`px-3 py-2 text-right ${r.profitPerDayUsd >= 0 ? "text-good" : "text-bad"}`}>{usd2(r.profitPerDayUsd)}</td>
                <td className={`px-3 py-2 text-right ${r.breakEvenKwh >= price ? "text-fg" : "text-bad"}`}>${r.breakEvenKwh.toFixed(3)}</td>
                <td className="px-3 py-2 text-right text-fg-2">{formatUsd(r.usdPerTh)}</td>
                <td className="px-3 py-2 text-right text-fg-2">{r.paybackDays === null ? "never" : r.paybackDays > 3650 ? ">10 yr" : `${Math.round(r.paybackDays)} d`}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => add(r)} aria-label={`Add ${r.name} to the farm`}>
                    Add
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Payback is simple: hardware price ÷ today&apos;s profit per day, ignoring difficulty growth, halvings and wear. Use
        Projections for the full picture.
      </p>
    </Card>
  );
}
