"use client";

import { useMemo } from "react";
import { HardHat, Wrench } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Input from "./ui/Input";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import { formatUsd, formatNumber } from "@/lib/utils";
import {
  RACK_MINERS_CAPACITY,
  CONTAINER_MINERS_CAPACITY,
} from "@/lib/calculations";

export default function LaborCosts() {
  const { config, updateLabor, updateMaintenanceLabor } = useFarmStore();
  const { labor, miners, maintenanceLabor } = config;
  const isContainerSetup = config.infrastructureType === "containers";

  const breakdown = useMemo(() => {
    const totalMiners = miners.reduce((sum, { quantity }) => sum + quantity, 0);
    if (totalMiners === 0) return null;

    const racksNeeded = Math.ceil(totalMiners / RACK_MINERS_CAPACITY);
    const containersNeeded = Math.ceil(totalMiners / CONTAINER_MINERS_CAPACITY);

    const minerHours = totalMiners * labor.manHoursPerMiner;
    const transformerHours = 1 * labor.manHoursPerTransformer;
    const rackHours = racksNeeded * labor.manHoursPerRack;
    const containerHours = isContainerSetup ? containersNeeded * labor.manHoursPerContainer : 0;
    const totalLaborHours = minerHours + transformerHours + rackHours + containerHours;

    const laborCost = totalLaborHours * labor.hourlyLaborCostUsd;
    const cablesAndBreakers = totalMiners * labor.cablesPerMinerUsd;
    const totalDeploymentCapex = laborCost + cablesAndBreakers;

    return {
      totalMiners,
      racksNeeded,
      containersNeeded,
      minerHours,
      transformerHours,
      rackHours,
      containerHours,
      totalLaborHours,
      laborCost,
      cablesAndBreakers,
      totalDeploymentCapex,
    };
  }, [miners, labor, isContainerSetup]);

  function handleChange(field: keyof typeof labor, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) updateLabor({ [field]: num });
  }

  const fields: {
    key: keyof typeof labor;
    label: string;
    step: string;
    tooltip: string;
  }[] = [
    {
      key: "manHoursPerMiner",
      label: "Man hours per miner",
      step: "0.5",
      tooltip:
        "Total labor hours spent per miner throughout the full deployment flow: unpacking, installing in place, connecting power and network, and configuring firmware. Default is 1 hour per unit; set higher for first-time crews or complex site constraints.",
    },
    {
      key: "hourlyLaborCostUsd",
      label: "Hourly labor cost (USD)",
      step: "1",
      tooltip:
        "Fully-loaded hourly rate for deployment technicians, including wages, benefits, and overhead. Industrial electricians and data-center techs typically cost $25–$60/hr.",
    },
    {
      key: "cablesPerMinerUsd",
      label: "Cables & breaker per miner (USD)",
      step: "5",
      tooltip:
        "Per-miner cost for a 6-meter copper power cable (C13/C19 to PDU) plus a dedicated 20A fuse breaker. Covers materials only — labor is captured separately in the man-hours fields.",
    },
    {
      key: "manHoursPerTransformer",
      label: "Man hours per transformer",
      step: "1",
      tooltip:
        "Labor hours to deliver, position, trench conduit, and wire a pad-mounted transformer including load testing and sign-off by a licensed electrician. Typical range: 6–16 hours.",
    },
    {
      key: "manHoursPerRack",
      label: "Man hours per rack",
      step: "0.5",
      tooltip:
        "Labor hours to assemble and anchor a 42U open-frame rack, run overhead cable management, install a PDU, and label all circuits. Typical range: 2–6 hours.",
    },
    {
      key: "manHoursPerContainer",
      label: "Man hours per container",
      step: "2",
      tooltip:
        "Labor hours to site-prep, position, connect power and cooling hookups, and commission a 20-ft mining container. Includes mechanical and electrical rough-in. Typical range: 24–60 hours.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Input Card */}
      <Card>
        <CardIllustration theme="tools" />
        <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <HardHat className="h-5 w-5" />
          Deployment Labor Costs
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          One-time deployment labor and per-unit materials added to total CAPEX.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {fields.map(({ key, label, step, tooltip }) => (
            <div key={key}>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                {label}
                <Tooltip content={tooltip} />
              </label>
              <Input
                type="number"
                step={step}
                min="0"
                value={labor[key]}
                onChange={(e) => handleChange(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Maintenance Labor Costs */}
      <Card>
        <CardIllustration theme="tools" />
        <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Maintenance Labor Costs
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Recurring monthly labor for farm upkeep, added to OPEX.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              Hourly maintenance cost (USD)
              <Tooltip content="Hourly rate for on-site maintenance technicians who perform routine inspections, swap failed units, clean filters, and handle day-to-day farm upkeep. Typically $25–$60/hr." />
            </label>
            <Input
              type="number"
              step="1"
              min="0"
              value={maintenanceLabor.hourlyMaintenanceCostUsd}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                if (!isNaN(num) && num >= 0) updateMaintenanceLabor({ hourlyMaintenanceCostUsd: num });
              }}
            />
          </div>
        </div>

        {breakdown && (() => {
          const totalFans = (config.temperature?.airFanSelections ?? [])
            .reduce((sum, sel) => sum + sel.quantity, 0);
          const isSmallFarm = breakdown.totalMiners <= 20;
          const hours = isSmallFarm
            ? 8
            : 30 + breakdown.totalMiners * 0.2 + totalFans * 1;
          const monthlyCost = hours * maintenanceLabor.hourlyMaintenanceCostUsd;

          return (
            <div className="mt-6 pt-5 border-t border-slate-200/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Monthly Estimate
              </p>
              <div className="space-y-2 text-sm">
                {isSmallFarm ? (
                  <BreakdownRow label="Small farm (≤ 20 miners) base hours" value="8.0 h" />
                ) : (
                  <>
                    <BreakdownRow label="Base hours (> 20 miners)" value="30.0 h" />
                    <BreakdownRow
                      label={`${breakdown.totalMiners} miners × 0.2 h`}
                      value={`${(breakdown.totalMiners * 0.2).toFixed(1)} h`}
                    />
                    {totalFans > 0 && (
                      <BreakdownRow
                        label={`${totalFans} air fan${totalFans !== 1 ? "s" : ""} × 1 h`}
                        value={`${totalFans.toFixed(1)} h`}
                      />
                    )}
                  </>
                )}
                <div className="pt-2 border-t border-slate-200/50 flex justify-between font-semibold">
                  <span className="text-slate-900">Total monthly hours</span>
                  <span className="font-mono text-slate-700">{formatNumber(hours)} h</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-900">Monthly maintenance labor</span>
                  <span className="text-blueprint-deep font-mono text-lg">
                    {formatUsd(monthlyCost)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Annual estimate</span>
                  <span className="font-mono">{formatUsd(monthlyCost * 12)}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </Card>

      {/* Summary Card */}
      {breakdown ? (
        <Card>
          <CardIllustration theme="chart" />
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Deployment Cost Breakdown
          </h2>

          {/* Labor Hours Breakdown */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Labor Hours
            </p>
            <div className="space-y-2 text-sm">
              <BreakdownRow
                label={`${breakdown.totalMiners} miners × ${labor.manHoursPerMiner} h`}
                value={`${formatNumber(breakdown.minerHours)} h`}
              />
              <BreakdownRow
                label={`1 transformer × ${labor.manHoursPerTransformer} h`}
                value={`${formatNumber(breakdown.transformerHours)} h`}
              />
              <BreakdownRow
                label={`${breakdown.racksNeeded} rack${breakdown.racksNeeded !== 1 ? "s" : ""} × ${labor.manHoursPerRack} h`}
                value={`${formatNumber(breakdown.rackHours)} h`}
              />
              <BreakdownRow
                label={`${breakdown.containersNeeded} container${breakdown.containersNeeded !== 1 ? "s" : ""} × ${labor.manHoursPerContainer} h`}
                value={`${formatNumber(breakdown.containerHours)} h`}
              />
              <div className="pt-2 border-t border-slate-200/50 flex justify-between font-semibold">
                <span className="text-slate-900">Total labor hours</span>
                <span className="font-mono text-slate-700">{formatNumber(breakdown.totalLaborHours)} h</span>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Cost Summary
            </p>
            <div className="space-y-2 text-sm">
              <BreakdownRow
                label={`Deployment labor (${formatNumber(breakdown.totalLaborHours)} h × $${labor.hourlyLaborCostUsd}/h)`}
                value={formatUsd(breakdown.laborCost)}
              />
              <BreakdownRow
                label={`Cables & breakers (${breakdown.totalMiners} miners × $${labor.cablesPerMinerUsd})`}
                value={formatUsd(breakdown.cablesAndBreakers)}
              />
              <div className="pt-2 mt-1 border-t border-slate-200/50 flex justify-between font-semibold">
                <span className="text-slate-900">Total deployment CAPEX</span>
                <span className="text-blueprint-deep font-mono text-lg">
                  {formatUsd(breakdown.totalDeploymentCapex)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-10">
            <div className="text-5xl mb-4">🔧</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Miners Yet</h3>
            <p className="text-slate-500">Add miners in the Build tab to see cost estimates.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-700 font-medium">{value}</span>
    </div>
  );
}
