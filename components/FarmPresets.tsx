"use client";

import { Home, Warehouse, Factory, Building2 } from "lucide-react";
import Card from "./ui/Card";
import { useFarmStore } from "@/lib/store";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";
import { PRESETS, resolvePresetMiners, type FarmPreset, type PresetId } from "@/lib/presets";

const PRESET_STYLE: Record<PresetId, { icon: typeof Home; color: string }> = {
  home: { icon: Home, color: "text-emerald-600" },
  garage: { icon: Warehouse, color: "text-blue-600" },
  "small-farm": { icon: Building2, color: "text-violet-600" },
  industrial: { icon: Factory, color: "text-amber-600" },
};

// Preview stats from the catalog rows the preset resolves to
function presetStats(preset: FarmPreset) {
  let hashrate = 0;
  let powerKw = 0;
  let cost = 0;
  for (const { miner, quantity } of resolvePresetMiners(preset)) {
    hashrate += miner.hash_rate_ths * quantity;
    powerKw += (miner.power_watts * quantity) / 1000;
    cost += miner.price_usd * quantity;
  }
  return { hashrate, powerKw, cost };
}

export default function FarmPresets() {
  const { config, applyPreset } = useFarmStore();
  const hasFarm = config.miners.length > 0;

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
          const { icon: Icon, color } = PRESET_STYLE[preset.id];
          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className="flex flex-col gap-2 p-4 rounded-2xl glass-inner text-left hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
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
