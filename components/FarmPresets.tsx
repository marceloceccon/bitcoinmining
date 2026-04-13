"use client";

import { Home, Warehouse, Factory, Building2 } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import { useFarmStore } from "@/lib/store";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";
import type { Miner, InfrastructureType } from "@/types";

// Embedded miner snapshots so presets work even when Supabase is down
const PRESET_MINERS: Record<string, Miner> = {
  "s21-pro": {
    id: "s21-pro", name: "Antminer S21 Pro", manufacturer: "Bitmain",
    algorithm: "SHA-256", hash_rate_ths: 234, power_watts: 3510,
    price_usd: 5499, efficiency_jth: 15.0, release_year: 2024,
    watercooled: false, degradation_year1: 2, degradation_year2: 5, degradation_year3plus: 8,
  },
  "s21-hyd": {
    id: "s21-hyd", name: "Antminer S21 Hyd", manufacturer: "Bitmain",
    algorithm: "SHA-256", hash_rate_ths: 335, power_watts: 5360,
    price_usd: 7999, efficiency_jth: 16.0, release_year: 2024,
    watercooled: true, degradation_year1: 2, degradation_year2: 5, degradation_year3plus: 8,
  },
  "m60s": {
    id: "m60s", name: "Whatsminer M60S", manufacturer: "MicroBT",
    algorithm: "SHA-256", hash_rate_ths: 186, power_watts: 3344,
    price_usd: 4299, efficiency_jth: 18.0, release_year: 2024,
    watercooled: false, degradation_year1: 2, degradation_year2: 5, degradation_year3plus: 8,
  },
};

interface Preset {
  name: string;
  description: string;
  icon: typeof Home;
  miners: { id: string; quantity: number }[];
  infrastructure: InfrastructureType;
  color: string;
}

const PRESETS: Preset[] = [
  {
    name: "Home Miner",
    description: "1-3 units on residential power, no transformer needed",
    icon: Home,
    miners: [{ id: "s21-pro", quantity: 2 }],
    infrastructure: "racks",
    color: "text-emerald-600",
  },
  {
    name: "Garage Setup",
    description: "10 units, semi-professional, single-phase transformer",
    icon: Warehouse,
    miners: [{ id: "s21-pro", quantity: 10 }],
    infrastructure: "racks",
    color: "text-blue-600",
  },
  {
    name: "Small Farm",
    description: "100 air-cooled units in containers",
    icon: Building2,
    miners: [{ id: "s21-pro", quantity: 100 }],
    infrastructure: "containers",
    color: "text-violet-600",
  },
  {
    name: "Industrial",
    description: "500 hydro-cooled units, 3-phase power, full infrastructure",
    icon: Factory,
    miners: [{ id: "s21-hyd", quantity: 500 }],
    infrastructure: "containers",
    color: "text-amber-600",
  },
];

export default function FarmPresets() {
  const { config, addMiner, updateInfrastructureType, reset } = useFarmStore();
  const hasFarm = config.miners.length > 0;

  function applyPreset(preset: Preset) {
    // Reset farm first
    reset();

    // Apply miners
    for (const entry of preset.miners) {
      const miner = PRESET_MINERS[entry.id];
      if (!miner) continue;
      addMiner({ miner, quantity: entry.quantity });
    }

    // Set infrastructure type
    updateInfrastructureType(preset.infrastructure);
  }

  // Compute preview for each preset
  function presetStats(preset: Preset) {
    let hashrate = 0;
    let powerKw = 0;
    let cost = 0;
    for (const entry of preset.miners) {
      const miner = PRESET_MINERS[entry.id];
      if (!miner) continue;
      hashrate += miner.hash_rate_ths * entry.quantity;
      powerKw += (miner.power_watts * entry.quantity) / 1000;
      cost += miner.price_usd * entry.quantity;
    }
    return { hashrate, powerKw, cost };
  }

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-1">
        {hasFarm ? "Farm Presets" : "Quick Start"}
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        {hasFarm
          ? "Replace your current config with a preset template."
          : "Choose a starting template, then customize everything."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESETS.map((preset) => {
          const stats = presetStats(preset);
          const Icon = preset.icon;
          return (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="flex flex-col gap-2 p-4 rounded-2xl glass-inner text-left hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${preset.color}`} />
                <span className="font-semibold text-sm text-slate-900">{preset.name}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{preset.description}</p>
              <div className="mt-auto pt-2 border-t border-slate-200/50 text-xs font-mono tabular-nums space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hashrate</span>
                  <span className="text-slate-700">{formatHashRate(stats.hashrate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Power</span>
                  <span className="text-slate-700">{formatPower(stats.powerKw)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hardware</span>
                  <span className="text-blueprint-deep">{formatUsd(stats.cost)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
