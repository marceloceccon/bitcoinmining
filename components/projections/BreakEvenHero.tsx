"use client";

import type { ForecastResult } from "@/types";
import Card from "@/components/ui/Card";
import Metric from "@/components/ui/Metric";
import HelpTooltip from "@/components/ui/Tooltip";
import { formatBtc, formatUsd } from "@/lib/utils";

interface Props {
  forecast: ForecastResult;
  startPrice: number;
  months: number;
  discountRate: number;
}

/**
 * The Projections hero: the BTC price this farm needs over the horizon, against
 * where the price is today ("you are here"), and the margin of safety between them.
 */
export default function BreakEvenHero({ forecast, startPrice, months, discountRate }: Props) {
  const { breakEvenBtcPrice: be, breakEvenBtcPriceWithCapex: beCapex, paybackMonths, irr, npv, totalBtcMined } = forecast.summary;
  const margin = startPrice > 0 ? (startPrice - be) / startPrice : 0;
  const scaleMax = Math.max(startPrice, beCapex, be) * 1.2 || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;
  const safe = margin >= 0;

  return (
    <Card className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="min-w-0 space-y-4">
        <div>
          <p className="label flex items-center gap-1">
            Break-even BTC price · {months} months
            <HelpTooltip
              label="About the break-even BTC price"
              content="The average BTC price at which mining revenue covers all operating costs over the forecast horizon (halvings, network growth and ASIC wear included). The 'incl. CAPEX' price also repays the hardware and build-out."
            />
          </p>
          <p className="mt-1 font-mono text-4xl font-medium tracking-tight text-fg">{formatUsd(be)}</p>
          <p className={`mt-1 font-mono text-sm ${safe ? "text-good" : "text-bad"}`}>
            {safe
              ? `${(margin * 100).toFixed(0)}% margin of safety below today's ${formatUsd(startPrice)}`
              : `${formatUsd(be - startPrice)} above today's ${formatUsd(startPrice)}: OPEX isn't covered at this price`}
          </p>
        </div>

        <div aria-hidden className="pt-6">
          <div className="relative h-8 rounded border border-line bg-surface-2">
            <div className={`absolute inset-y-0 left-0 ${safe ? "bg-good/15" : "bg-bad/15"}`} style={{ width: pct(startPrice) }} />
            <span className="absolute inset-y-0 w-0.5 bg-fg" style={{ left: pct(be) }} />
            <span className="absolute inset-y-0 w-0.5 bg-muted" style={{ left: pct(beCapex) }} />
            <span className="absolute -inset-y-1.5 w-0.5 bg-btc" style={{ left: pct(startPrice) }}>
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-btc">you are here</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-4 font-mono text-[11px] text-muted">
            <span>$0</span>
            <span>break-even {formatUsd(be)}</span>
            <span>incl. CAPEX {formatUsd(beCapex)}</span>
            <span>{formatUsd(scaleMax)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 self-center">
        <Metric label="Payback" value={paybackMonths ?? 0} format={(v) => (paybackMonths === null ? `>${months} mo` : `${Math.round(v)} mo`)} size="sm" hint="operating cash vs CAPEX" />
        <Metric label="IRR" value={irr ?? 0} format={(v) => (irr === null ? "n/a" : `${v.toFixed(1)}%`)} better="up" size="sm" hint={irr === null ? "never repays CAPEX" : "annual"} />
        <Metric label="NPV" value={npv} format={(v) => formatUsd(v)} better="up" size="sm" hint={`at ${discountRate}% discount`} />
        <Metric label="BTC mined" value={totalBtcMined} format={(v) => formatBtc(v, 3)} better="up" size="sm" hint={`over ${months} months`} />
      </div>
    </Card>
  );
}
