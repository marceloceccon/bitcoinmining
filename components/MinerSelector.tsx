"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { useFarmStore } from "@/lib/store";
import { getMiners } from "@/lib/supabase";
import type { Miner } from "@/types";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";

export default function MinerSelector() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { addMiner, updateMinerQuantity, config } = useFarmStore();

  useEffect(() => {
    loadMiners();
  }, []);

  async function loadMiners() {
    try {
      const data = await getMiners();
      setMiners(data || []);
    } catch (error) {
      console.error("Failed to load miners:", error);
      // Use fallback data if Supabase fails
      setMiners(getFallbackMiners());
    } finally {
      setLoading(false);
    }
  }

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
      <CardIllustration theme="circuit" />
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

// Fallback miner data (if Supabase fails)
function getFallbackMiners(): Miner[] {
  return [
    {
      id: "s21-pro",
      name: "Antminer S21 Pro",
      manufacturer: "Bitmain",
      algorithm: "SHA-256",
      hash_rate_ths: 234,
      power_watts: 3510,
      price_usd: 5499,
      efficiency_jth: 15.0,
      release_year: 2024,
      watercooled: false,
      degradation_year1: 2,
      degradation_year2: 5,
      degradation_year3plus: 8,
    },
    {
      id: "s21-hyd",
      name: "Antminer S21 Hyd",
      manufacturer: "Bitmain",
      algorithm: "SHA-256",
      hash_rate_ths: 335,
      power_watts: 5360,
      price_usd: 7999,
      efficiency_jth: 16.0,
      release_year: 2024,
      watercooled: true,
      degradation_year1: 2,
      degradation_year2: 5,
      degradation_year3plus: 8,
    },
    {
      id: "m60s",
      name: "Whatsminer M60S",
      manufacturer: "MicroBT",
      algorithm: "SHA-256",
      hash_rate_ths: 186,
      power_watts: 3344,
      price_usd: 4299,
      efficiency_jth: 18.0,
      release_year: 2024,
      watercooled: false,
      degradation_year1: 2,
      degradation_year2: 5,
      degradation_year3plus: 8,
    },
  ];
}
