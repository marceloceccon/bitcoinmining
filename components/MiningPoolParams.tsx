"use client";

import { Layers } from "lucide-react";
import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Slider from "./ui/Slider";
import Button from "./ui/Button";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import type { PayoutScheme } from "@/types";

const PAYOUT_SCHEME_DEFAULT_FEES: Record<PayoutScheme, number> = {
  pps: 2.0,
  pplns: 1.0,
  fpps: 2.5,
  ppsplus: 2.0,
};

const payoutSchemeTooltip = (
  <div className="space-y-1.5">
    <p><strong className="text-blueprint-deep">PPS</strong>: Fixed payout per valid share. Pool absorbs variance. ~2% fee.</p>
    <p><strong className="text-blueprint-deep">PPLNS</strong>: Payout based on your share of recent work. Lower fee (~1%), rewards vary with luck.</p>
    <p><strong className="text-blueprint-deep">FPPS</strong>: Like PPS but includes transaction fees in payouts. Best for steady income. ~2.5% fee.</p>
    <p><strong className="text-blueprint-deep">PPS+</strong>: Base block reward via PPS + proportional tx fees. Moderate fee and variance.</p>
  </div>
);

export default function MiningPoolParams() {
  const { config, updatePayoutScheme, updatePoolFee } = useFarmStore();

  const payoutSchemePresets: { scheme: PayoutScheme; label: string }[] = [
    { scheme: "pps", label: "PPS" },
    { scheme: "pplns", label: "PPLNS" },
    { scheme: "fpps", label: "FPPS" },
    { scheme: "ppsplus", label: "PPS+" },
  ];

  function handlePayoutSchemeSelect(scheme: PayoutScheme) {
    updatePayoutScheme(scheme);
    updatePoolFee(PAYOUT_SCHEME_DEFAULT_FEES[scheme]);
  }

  return (
    <Card>
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Layers className="h-5 w-5 text-blueprint-deep" />
        Mining Pool Parameters
      </h2>

      <div className="space-y-4">
        {/* Payout Scheme */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
            Payout Scheme
            <Tooltip content={payoutSchemeTooltip} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {payoutSchemePresets.map((preset) => (
              <Button
                key={preset.scheme}
                variant={config.payoutScheme === preset.scheme ? "primary" : "default"}
                size="sm"
                onClick={() => handlePayoutSchemeSelect(preset.scheme)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Pool Fee */}
        <Slider
          label="Pool Fee"
          unit="%"
          min={0}
          max={5}
          step={0.1}
          value={config.poolFeePercent}
          onChange={(e) => updatePoolFee(parseFloat(e.target.value))}
          tooltip="The percentage of your mining revenue retained by the pool as a fee. Set automatically when you select a payout scheme, but you can override it here."
        />
      </div>
    </Card>
  );
}
