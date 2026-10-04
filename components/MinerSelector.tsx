"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Card from "./ui/Card";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { useFarmStore } from "@/lib/store";
import { useMiners } from "@/lib/apiClient";
import { hardwarePricesAsOf } from "@/lib/catalog";
import type { Miner, MinerSegment, MinerStatus } from "@/types";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";

const STATUS_ORDER: Record<MinerStatus, number> = { current: 0, announced: 1, legacy: 2 };
const SEGMENTS: { id: MinerSegment | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "industrial", label: "Industrial" },
  { id: "home", label: "Home" },
];

function priceNote(miner: Miner): string | null {
  if (miner.price_basis === "used") return "used-market price";
  if (miner.price_basis === "index") return "index estimate";
  return null;
}

export default function MinerSelector() {
  const { miners } = useMiners();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<MinerSegment | "all">("all");
  const [showAnnounced, setShowAnnounced] = useState(false);
  const { addMiner, updateMinerQuantity, config } = useFarmStore();

  const filteredMiners = useMemo(() => {
    const q = search.toLowerCase();
    return miners
      .filter((m) => showAnnounced || m.status !== "announced")
      .filter((m) => segment === "all" || m.segment === segment)
      .filter((m) => m.name.toLowerCase().includes(q) || m.manufacturer.toLowerCase().includes(q))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.efficiency_jth - b.efficiency_jth);
  }, [miners, search, segment, showAnnounced]);

  const handleAddMiner = (miner: Miner) => {
    const existing = config.miners.find((m) => m.miner.id === miner.id);
    if (existing) {
      updateMinerQuantity(miner.id, existing.quantity + 1);
    } else {
      addMiner({ miner, quantity: 1 });
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-bold text-fg">Miner Database</h2>
        <span className="text-xs text-muted">Hardware prices as of {hardwarePricesAsOf()}</span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
        <Input
          placeholder="Search miners..."
          aria-label="Search miners"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {SEGMENTS.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={segment === s.id ? "primary" : "default"}
            aria-pressed={segment === s.id}
            onClick={() => setSegment(s.id)}
          >
            {s.label}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showAnnounced} onChange={(e) => setShowAnnounced(e.target.checked)} />
          Show announced (not yet shipping)
        </label>
      </div>

      {/* Miner List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredMiners.map((miner) => (
          <div
            key={miner.id}
            className="flex items-center justify-between p-3 inset hover: transition-all duration-200"
          >
            <div className="flex-1">
              <div className="font-semibold text-fg text-sm flex flex-wrap items-center gap-1.5">
                {miner.name}
                {miner.status !== "current" && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-muted border border-line rounded px-1">
                    {miner.status}
                  </span>
                )}
                {miner.cooling !== "air" && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-cool border border-cool/30 rounded px-1">
                    {miner.cooling}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                {miner.manufacturer} · {formatHashRate(miner.hash_rate_ths)} ·{" "}
                {formatPower(miner.power_watts / 1000)} · {miner.efficiency_jth.toFixed(1)} J/TH
              </div>
            </div>
            <div className="text-right mr-4">
              {miner.price_source.startsWith("http") ? (
                <a
                  href={miner.price_source}
                  title={`${miner.price_basis} price, as of ${miner.price_as_of}`}
                  className="block font-mono text-sm font-semibold text-fg hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatUsd(miner.price_usd)}
                </a>
              ) : (
                <span title={`${miner.price_basis} price, as of ${miner.price_as_of}: ${miner.price_source}`} className="block font-mono text-sm font-semibold text-fg">
                  {formatUsd(miner.price_usd)}
                </span>
              )}
              {priceNote(miner) && <div className="text-[10px] text-faint">{priceNote(miner)}</div>}
            </div>
            <Button variant="primary" size="sm" onClick={() => handleAddMiner(miner)} aria-label={`Add ${miner.name}`}>
              Add
            </Button>
          </div>
        ))}
      </div>

      {filteredMiners.length === 0 && (
        <div className="text-center py-8 text-faint">
          No miners found
        </div>
      )}
    </Card>
  );
}
