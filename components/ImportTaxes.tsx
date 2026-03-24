"use client";

import Card from "./ui/Card";
import CardIllustration from "./ui/CardIllustration";
import Slider from "./ui/Slider";
import Tooltip from "./ui/Tooltip";
import { useFarmStore } from "@/lib/store";
import type { ImportTaxConfig } from "@/types";

const TAX_CATEGORIES: { key: keyof ImportTaxConfig; label: string }[] = [
  { key: "miners", label: "Miners" },
  { key: "racks", label: "Racks" },
  { key: "containers", label: "Containers" },
  { key: "fans", label: "Fans" },
  { key: "dryCoolers", label: "Dry Coolers" },
];

export default function ImportTaxes() {
  const { config, updateImportTax } = useFarmStore();

  return (
    <Card>
      <CardIllustration theme="shield" />
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        Import Taxes
        <Tooltip content="Import duty applied to hardware purchases. Each component class can have a different tax rate depending on your country's tariff schedule." />
      </h2>
      <div className="space-y-3">
        {TAX_CATEGORIES.map(({ key, label }) => (
          <Slider
            key={key}
            label={label}
            unit="%"
            min={0}
            max={100}
            step={1}
            value={config.importTax[key]}
            onChange={(e) => updateImportTax({ [key]: Number(e.target.value) })}
          />
        ))}
      </div>
    </Card>
  );
}
