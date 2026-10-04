"use client";

import { useMemo } from "react";
import { m } from "motion/react";
import type { FarmConfig } from "@/types";
import type { FarmReport } from "@/lib/farmReport";
import { DEFAULT_CLIMATE, dryCoolerDeratingFactor, recommendCoolingSelections } from "@/lib/cooling";
import { useFarmStore } from "@/lib/store";
import Metric from "@/components/ui/Metric";
import { formatUsd } from "@/lib/utils";

const sumQty = (sel: { quantity: number }[]) => sel.reduce((n, s) => n + s.quantity, 0);
const DERATE_MIN = 0.5;
const DERATE_MAX = 1.3;

/**
 * What the site's climate does to the farm: design temperature and humidity,
 * the dry-cooler derating it causes, and how many cooling units that adds or
 * saves against the temperate default climate. Values roll and the gauge sweeps
 * when a new pin is dropped.
 */
export default function SiteThermalSummary({ config, report }: { config: FarmConfig; report: FarmReport }) {
  const dryCoolers = useFarmStore((s) => s.dryCoolerCatalog);
  const airFans = useFarmStore((s) => s.airFanCatalog);
  const climate = config.temperature?.location ?? DEFAULT_CLIMATE;
  const derating = dryCoolerDeratingFactor(climate.maxTempC);

  const delta = useMemo(() => {
    const atDefault = recommendCoolingSelections({ ...config, temperature: { location: null, dryCoolerSelections: [], airFanSelections: [] } }, dryCoolers, airFans);
    const current = config.temperature ?? { dryCoolerSelections: [], airFanSelections: [] };
    return {
      dryCoolers: sumQty(current.dryCoolerSelections) - sumQty(atDefault.dryCoolerSelections),
      fans: sumQty(current.airFanSelections) - sumQty(atDefault.airFanSelections),
      hasHydro: atDefault.dryCoolerSelections.length > 0,
      hasAir: atDefault.airFanSelections.length > 0,
    };
  }, [config, dryCoolers, airFans]);

  const coolingCapex = report.metrics.dryCoolerCapex + report.metrics.airFanCapex;
  const gaugePct = ((derating - DERATE_MIN) / (DERATE_MAX - DERATE_MIN)) * 100;
  const deltaText = (n: number, noun: string) =>
    n === 0 ? `same ${noun} as the default climate` : `${n > 0 ? "+" : "−"}${Math.abs(n)} ${noun} vs default climate`;

  return (
    <div className="grid gap-4 border-y border-line py-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
      <Metric label="Design max temp" value={climate.maxTempC} format={(v) => `${v.toFixed(1)} °C`} better="down" size="sm" hint={climate.city} />
      <Metric label="Avg humidity" value={climate.avgHumidityPercent} format={(v) => `${v.toFixed(0)}%`} better="down" size="sm" hint="ERA5 hourly mean" />
      <div className="grid gap-1">
        <span className="label">Dry cooler derating</span>
        <span className={`font-mono text-base ${derating < 1 ? "text-heat" : "text-cool"}`}>{(derating * 100).toFixed(0)}% of rated</span>
        <div className="relative h-1.5 rounded-full bg-line" aria-hidden>
          <span className="absolute inset-y-0 w-px bg-fg" style={{ left: `${((1 - DERATE_MIN) / (DERATE_MAX - DERATE_MIN)) * 100}%` }} />
          <m.span
            className={`absolute inset-y-0 left-0 rounded-full ${derating < 1 ? "bg-heat" : "bg-cool"}`}
            initial={false}
            animate={{ width: `${gaugePct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        <span className="font-mono text-xs text-muted">35 °C rating = 100%</span>
      </div>
      <Metric
        label="Cooling CAPEX"
        value={coolingCapex}
        format={(v) => formatUsd(v)}
        better="down"
        size="sm"
        hint={[delta.hasHydro && deltaText(delta.dryCoolers, "dry coolers"), delta.hasAir && deltaText(delta.fans, "fans")].filter(Boolean).join(" · ")}
      />
    </div>
  );
}
