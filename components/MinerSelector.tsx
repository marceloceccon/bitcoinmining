"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { useFarmStore } from "@/lib/store";
import { useMiners } from "@/lib/apiClient";
import type { Miner } from "@/types";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";

export default function MinerSelector() {
  const { miners, loading } = useMiners();
  const [search, setSearch] = useState("");
  const { addMiner, updateMinerQuantity, config } = useFarmStore();

  const filteredMiners = miners.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddMiner = (miner: Miner) => {
    const existing = config.miners.find((m) => m.miner.id === miner.id);
    if (existing) {
      updateMinerQuantity(miner.id, existing.quantity + 1);
    } else {
      addMiner({ miner, quantity: 1 });
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-100/50 rounded-xl" />
          <div className="h-20 bg-slate-100/50 rounded-xl" />
          <div className="h-20 bg-slate-100/50 rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4">Miner Database</h2>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search miners..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Miner List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredMiners.map((miner) => (
          <div
            key={miner.id}
            className="flex items-center justify-between p-3 glass-inner hover:shadow-sm transition-all duration-200"
          >
            <div className="flex-1">
              <div className="font-semibold text-slate-900 text-sm">{miner.name}</div>
              <div className="text-xs text-slate-500">
                {miner.manufacturer} · {formatHashRate(miner.hash_rate_ths)} ·{" "}
                {formatPower(miner.power_watts / 1000)} · {miner.efficiency_jth.toFixed(1)} J/TH
              </div>
            </div>
            <div className="text-right mr-4">
              <div className="font-semibold text-blueprint-deep font-mono text-sm">
                {formatUsd(miner.price_usd)}
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAddMiner(miner)}
            >
              Add
            </Button>
          </div>
        ))}
      </div>

      {filteredMiners.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          No miners found
        </div>
      )}
    </Card>
  );
}
