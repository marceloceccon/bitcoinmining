"use client";

import { Trash2, Plus, Minus, Layers, Container } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Button from "./ui/Button";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { formatHashRate, formatPower, formatUsd } from "@/lib/utils";
import {
  RACK_COST_USD,
  RACK_MINERS_CAPACITY,
  CONTAINER_BASE_COST_USD,
  CONTAINER_MINERS_CAPACITY,
} from "@/lib/calculations";
import type { InfrastructureType } from "@/types";

function calcInfraPreview(
  totalMiners: number,
  type: InfrastructureType
): { rackCost: number; containerCost: number; rackUnits: number; containers: number } {
  const rackUnits = Math.ceil(totalMiners / RACK_MINERS_CAPACITY);
  const rackCost = rackUnits * RACK_COST_USD;
  if (type === "containers") {
    const containers = Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY);
    return { rackCost, containerCost: containers * CONTAINER_BASE_COST_USD, rackUnits, containers };
  }
  return { rackCost, containerCost: 0, rackUnits, containers: 0 };
}

export default function FarmBuilder() {
  const { config, updateMinerQuantity, removeMiner, updateInfrastructureType } = useFarmStore();

  const totalMiners = config.miners.reduce((sum, { quantity }) => sum + quantity, 0);
  const infra = calcInfraPreview(totalMiners, config.infrastructureType);

  if (config.miners.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="text-5xl mb-4 text-slate-300">+</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Miners Added</h3>
          <p className="text-slate-500">
            Select miners from the database above to build your farm
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
     
      <h2 className="text-lg font-bold text-slate-900 mb-4">Farm Configuration</h2>

      {/* Miner list */}
      <div className="space-y-3">
        {config.miners.map(({ miner, quantity }) => (
          <div
            key={miner.id}
            className="flex items-center gap-4 p-4 glass-inner row-hover"
          >
            <div className="flex-1">
              <div className="font-semibold text-slate-900 text-sm">{miner.name}</div>
              <div className="text-xs text-slate-500">
                {formatHashRate(miner.hash_rate_ths)} x {quantity} ={" "}
                <span className="text-blueprint-deep font-medium">
                  {formatHashRate(miner.hash_rate_ths * quantity)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateMinerQuantity(miner.id, Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="w-16 text-center font-mono font-semibold text-slate-900 tabular-nums">{quantity}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateMinerQuantity(miner.id, quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => updateMinerQuantity(miner.id, quantity + 100)}
              >
                +100
              </Button>
            </div>

            <div className="text-right min-w-[120px]">
              <div className="text-sm font-medium text-slate-700 font-mono tabular-nums">
                {formatPower((miner.power_watts * quantity) / 1000)}
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                {formatUsd(miner.price_usd * quantity)}
              </div>
            </div>

            <Button variant="destructive" size="sm" onClick={() => removeMiner(miner.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Infrastructure Type */}
      <div className="mt-6 pt-6 border-t border-slate-200/50">
        <div className="flex items-center gap-1 mb-3">
          <span className="text-sm font-medium text-slate-700">Infrastructure Setup</span>
          <Tooltip content="Choose how miners are housed. Steel Racks are open-frame shelving. Containers are modified 20ft shipping containers with flooring, insulation, basic electrical, and transport included in the base price." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Steel Racks option */}
          <button
            onClick={() => updateInfrastructureType("racks")}
            className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all duration-200 ${
              config.infrastructureType === "racks"
                ? "border-blueprint-deep/40 bg-blueprint-faint/50 shadow-sm"
                : "glass-inner hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers
                className={`h-5 w-5 ${
                  config.infrastructureType === "racks" ? "text-blueprint-deep" : "text-slate-400"
                }`}
              />
              <span
                className={`font-semibold text-sm ${
                  config.infrastructureType === "racks" ? "text-blueprint-deep" : "text-slate-700"
                }`}
              >
                Steel Racks
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Open-frame steel racks. {RACK_MINERS_CAPACITY} miners per rack at{" "}
              {formatUsd(RACK_COST_USD)} each.
            </p>
            {totalMiners > 0 && (
              <div className="mt-1 text-xs font-mono tabular-nums">
                <span className="text-slate-400">{infra.rackUnits} racks = </span>
                <span className={config.infrastructureType === "racks" ? "text-blueprint-deep font-semibold" : "text-slate-700"}>
                  {formatUsd(infra.rackCost)}
                </span>
              </div>
            )}
          </button>

          {/* Containers option */}
          <button
            onClick={() => updateInfrastructureType("containers")}
            className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all duration-200 ${
              config.infrastructureType === "containers"
                ? "border-blueprint-deep/40 bg-blueprint-faint/50 shadow-sm"
                : "glass-inner hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2">
              <Container
                className={`h-5 w-5 ${
                  config.infrastructureType === "containers" ? "text-blueprint-deep" : "text-slate-400"
                }`}
              />
              <span
                className={`font-semibold text-sm ${
                  config.infrastructureType === "containers" ? "text-blueprint-deep" : "text-slate-700"
                }`}
              >
                Containers
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              20ft shipping containers (bare + flooring + insulation + electrical + paint + transport).{" "}
              {formatUsd(CONTAINER_BASE_COST_USD)} base + rack space, up to {CONTAINER_MINERS_CAPACITY} miners each.
            </p>
            {totalMiners > 0 && (
              <div className="mt-1 text-xs font-mono tabular-nums space-y-0.5">
                <div>
                  <span className="text-slate-400">
                    {Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY)} container
                    {Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY) !== 1 ? "s" : ""} shell ={" "}
                  </span>
                  <span className={config.infrastructureType === "containers" ? "text-blueprint-deep" : "text-slate-700"}>
                    {formatUsd(infra.containerCost)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">{infra.rackUnits} rack units = </span>
                  <span className={config.infrastructureType === "containers" ? "text-blueprint-deep" : "text-slate-700"}>
                    {formatUsd(infra.rackCost)}
                  </span>
                </div>
                <div className="pt-0.5 border-t border-slate-200/50">
                  <span className="text-slate-400">Total = </span>
                  <span className={`font-semibold ${config.infrastructureType === "containers" ? "text-blueprint-deep" : "text-slate-700"}`}>
                    {formatUsd(infra.containerCost + infra.rackCost)}
                  </span>
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-slate-200/50">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Total Units:</span>
            <span className="ml-2 font-semibold text-slate-900 font-mono tabular-nums">{totalMiners}</span>
          </div>
          <div>
            <span className="text-slate-500">Hardware Cost:</span>
            <span className="ml-2 font-semibold text-blueprint-deep font-mono tabular-nums">
              {formatUsd(
                config.miners.reduce(
                  (sum, { miner, quantity }) => sum + miner.price_usd * quantity,
                  0
                )
              )}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
