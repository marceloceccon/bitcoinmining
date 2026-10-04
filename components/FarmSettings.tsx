"use client";

import Card from "./ui/Card";
import Slider from "./ui/Slider";
import { useFarmStore } from "@/lib/store";

/** Farm-wide assumptions that affect every tab: overhead power, uptime and maintenance. */
export default function FarmSettings() {
  const { config, updateParasiticLoad, updateUptime, updateMaintenanceOpex } = useFarmStore();
  return (
    <Card>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-lg font-semibold text-fg">
          Advanced farm settings
          <span className="font-mono text-xs font-normal text-muted group-open:hidden">
            parasitic {config.parasiticLoadPercent}% · uptime {config.uptimePercent}% · maintenance {config.maintenanceOpexPercent}%/yr
          </span>
        </summary>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Slider
            label="Parasitic load"
            unit="%"
            min={0}
            max={20}
            step={1}
            value={config.parasiticLoadPercent}
            onChange={(e) => updateParasiticLoad(Number(e.target.value))}
            tooltip="Power on top of the miners themselves: fans, dry-cooler motors, networking, lighting, PSU and transformer losses. Raises power, heat load and cooling."
          />
          <Slider
            label="Uptime"
            unit="%"
            min={80}
            max={100}
            step={0.5}
            value={config.uptimePercent}
            onChange={(e) => updateUptime(Number(e.target.value))}
            tooltip="Share of time the miners are hashing (curtailment, outages, maintenance). Scales revenue."
          />
          <Slider
            label="Maintenance"
            unit="%/yr"
            min={0}
            max={15}
            step={0.5}
            value={config.maintenanceOpexPercent}
            onChange={(e) => updateMaintenanceOpex(Number(e.target.value))}
            tooltip="Yearly repairs and spare parts as a share of CAPEX, charged monthly in OPEX."
          />
        </div>
      </details>
    </Card>
  );
}
