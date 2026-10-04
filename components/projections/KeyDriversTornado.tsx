"use client";

import type { KeyDrivers } from "@/lib/sensitivity";
import Card from "@/components/ui/Card";
import { formatUsd } from "@/lib/utils";

/**
 * Tornado chart: each bar spans the NPV when one input swings to its downside
 * (left, red) and upside (right, green); the centre line is the base case.
 */
export default function KeyDriversTornado({ drivers }: { drivers: KeyDrivers }) {
  const { baseNpv } = drivers;
  const maxDelta = Math.max(1, ...drivers.drivers.flatMap((d) => [Math.abs(d.low.npv - baseNpv), Math.abs(d.high.npv - baseNpv)]));
  const width = (v: number) => `${(Math.abs(v - baseNpv) / maxDelta) * 50}%`;

  return (
    <Card>
      <h3 className="text-base font-semibold text-fg">Key drivers</h3>
      <p className="mb-4 text-sm text-muted">NPV when one input moves, everything else at the base case ({formatUsd(baseNpv)})</p>
      <ul className="space-y-3">
        {drivers.drivers.map((d) => (
          <li key={d.driver} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm">
            <span className="text-fg-2">{d.driver}</span>
            <div>
              <div className="relative h-5" role="img" aria-label={`${d.driver}: ${d.low.label} gives NPV ${formatUsd(d.low.npv)}, ${d.high.label} gives ${formatUsd(d.high.npv)}`}>
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                <span className="absolute inset-y-0.5 rounded-l-sm bg-bad/70" style={{ right: "50%", width: width(d.low.npv) }} />
                <span className="absolute inset-y-0.5 rounded-r-sm bg-good/70" style={{ left: "50%", width: width(d.high.npv) }} />
              </div>
              <div className="mt-0.5 flex justify-between font-mono text-[11px] text-muted">
                <span>{d.low.label} · {formatUsd(d.low.npv - baseNpv)}</span>
                <span>{d.high.label} · +{formatUsd(d.high.npv - baseNpv)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
