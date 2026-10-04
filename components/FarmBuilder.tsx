"use client";

import { Trash2, Plus, Minus, Layers, Container } from "lucide-react";
import Card from "./ui/Card";
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
          <div className="text-5xl mb-4 text-faint">+</div>
          <h3 className="text-lg font-semibold text-fg mb-2">No Miners Added</h3>
          <p className="text-muted">
            Select miners from the database above to build your farm
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
     
      <h2 className="text-lg font-bold text-fg mb-4">Farm Configuration</h2>

      {/* Miner list */}
      <div className="space-y-3">
        {config.miners.map(({ miner, quantity }) => (
          <div
            key={miner.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 inset"
          >
            <div className="min-w-[10rem] flex-1">
              <div className="font-semibold text-fg text-sm">{miner.name}</div>
              <div className="text-xs text-muted">
                {formatHashRate(miner.hash_rate_ths)} x {quantity} ={" "}
                <span className="text-fg font-medium">
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
                aria-label={`One fewer ${miner.name}`}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="w-14 text-center font-mono font-semibold text-fg tabular-nums" aria-live="polite">{quantity}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateMinerQuantity(miner.id, quantity + 1)}
                aria-label={`One more ${miner.name}`}
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

            <div className="ml-auto text-right">
              <div className="text-sm font-medium text-fg-2 font-mono tabular-nums">
                {formatPower((miner.power_watts * quantity) / 1000)}
              </div>
              <div className="text-xs text-muted font-mono tabular-nums">
                {formatUsd(miner.price_usd * quantity)}
              </div>
            </div>

            <Button variant="ghost" size="sm" className="text-bad hover:text-bad" onClick={() => removeMiner(miner.id)} aria-label={`Remove ${miner.name}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Infrastructure Type */}
      <div className="mt-6 pt-6 border-t border-line">
        <div className="flex items-center gap-1 mb-3">
          <span className="text-sm font-medium text-fg-2">Infrastructure Setup</span>
          <Tooltip content="Choose how miners are housed. Steel Racks are open-frame shelving. Containers are modified 20ft shipping containers with flooring, insulation, basic electrical, and transport included in the base price." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Steel Racks option */}
          <button
            onClick={() => updateInfrastructureType("racks")}
            className={`flex flex-col gap-2 p-4 rounded border text-left transition-all duration-200 ${
              config.infrastructureType === "racks"
                ? "border-line-strong bg-surface-2"
                : "inset hover:"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers
                className={`h-5 w-5 ${
                  config.infrastructureType === "racks" ? "text-fg" : "text-faint"
                }`}
              />
              <span
                className={`font-semibold text-sm ${
                  config.infrastructureType === "racks" ? "text-fg" : "text-fg-2"
                }`}
              >
                Steel Racks
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Open-frame steel racks. {RACK_MINERS_CAPACITY} miners per rack at{" "}
              {formatUsd(RACK_COST_USD)} each.
            </p>
            {totalMiners > 0 && (
              <div className="mt-1 text-xs font-mono tabular-nums">
                <span className="text-faint">{infra.rackUnits} racks = </span>
                <span className={config.infrastructureType === "racks" ? "text-fg font-semibold" : "text-fg-2"}>
                  {formatUsd(infra.rackCost)}
                </span>
              </div>
            )}
          </button>

          {/* Containers option */}
          <button
            onClick={() => updateInfrastructureType("containers")}
            className={`flex flex-col gap-2 p-4 rounded border text-left transition-all duration-200 ${
              config.infrastructureType === "containers"
                ? "border-line-strong bg-surface-2"
                : "inset hover:"
            }`}
          >
            <div className="flex items-center gap-2">
              <Container
                className={`h-5 w-5 ${
                  config.infrastructureType === "containers" ? "text-fg" : "text-faint"
                }`}
              />
              <span
                className={`font-semibold text-sm ${
                  config.infrastructureType === "containers" ? "text-fg" : "text-fg-2"
                }`}
              >
                Containers
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              20ft shipping containers (bare + flooring + insulation + electrical + paint + transport).{" "}
              {formatUsd(CONTAINER_BASE_COST_USD)} base + rack space, up to {CONTAINER_MINERS_CAPACITY} miners each.
            </p>
            {totalMiners > 0 && (
              <div className="mt-1 text-xs font-mono tabular-nums space-y-0.5">
                <div>
                  <span className="text-faint">
                    {Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY)} container
                    {Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY) !== 1 ? "s" : ""} shell ={" "}
                  </span>
                  <span className={config.infrastructureType === "containers" ? "text-fg" : "text-fg-2"}>
                    {formatUsd(infra.containerCost)}
                  </span>
                </div>
                <div>
                  <span className="text-faint">{infra.rackUnits} rack units = </span>
                  <span className={config.infrastructureType === "containers" ? "text-fg" : "text-fg-2"}>
                    {formatUsd(infra.rackCost)}
                  </span>
                </div>
                <div className="pt-0.5 border-t border-line">
                  <span className="text-faint">Total = </span>
                  <span className={`font-semibold ${config.infrastructureType === "containers" ? "text-fg" : "text-fg-2"}`}>
                    {formatUsd(infra.containerCost + infra.rackCost)}
                  </span>
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-line">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Total Units:</span>
            <span className="ml-2 font-semibold text-fg font-mono tabular-nums">{totalMiners}</span>
          </div>
          <div>
            <span className="text-muted">Hardware Cost:</span>
            <span className="ml-2 font-semibold text-fg font-mono tabular-nums">
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
