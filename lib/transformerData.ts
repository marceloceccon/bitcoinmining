export interface TransformerModel {
  model: string;
  kva_rating: number;
  phase: 1 | 3;
  estimated_cost_usd: number;
  weight_kg: number;
}

/** Farms drawing less than this don't need a dedicated transformer */
export const NO_TRANSFORMER_THRESHOLD_KVA = 15;

export const TRANSFORMERS: TransformerModel[] = [
  { model: "15 kVA 1-Phase Pole-Mount",   kva_rating: 15,    phase: 1, estimated_cost_usd: 2200,   weight_kg: 90 },
  { model: "25 kVA 1-Phase Pole-Mount",   kva_rating: 25,    phase: 1, estimated_cost_usd: 3000,   weight_kg: 130 },
  { model: "37.5 kVA 1-Phase Pole-Mount", kva_rating: 37.5,  phase: 1, estimated_cost_usd: 4000,   weight_kg: 180 },
  { model: "50 kVA 1-Phase Pad-Mount",    kva_rating: 50,    phase: 1, estimated_cost_usd: 5500,   weight_kg: 250 },
  { model: "75 kVA 3-Phase Pad-Mount",    kva_rating: 75,    phase: 3, estimated_cost_usd: 8500,   weight_kg: 380 },
  { model: "112.5 kVA 3-Phase Pad-Mount", kva_rating: 112.5, phase: 3, estimated_cost_usd: 12000,  weight_kg: 520 },
  { model: "150 kVA 3-Phase Pad-Mount",   kva_rating: 150,   phase: 3, estimated_cost_usd: 15000,  weight_kg: 650 },
  { model: "225 kVA 3-Phase Pad-Mount",   kva_rating: 225,   phase: 3, estimated_cost_usd: 20000,  weight_kg: 850 },
  { model: "300 kVA 3-Phase Pad-Mount",   kva_rating: 300,   phase: 3, estimated_cost_usd: 26000,  weight_kg: 1100 },
  { model: "500 kVA 3-Phase Pad-Mount",   kva_rating: 500,   phase: 3, estimated_cost_usd: 38000,  weight_kg: 1600 },
  { model: "750 kVA 3-Phase Pad-Mount",   kva_rating: 750,   phase: 3, estimated_cost_usd: 52000,  weight_kg: 2200 },
  { model: "1000 kVA 3-Phase Pad-Mount",  kva_rating: 1000,  phase: 3, estimated_cost_usd: 72000,  weight_kg: 2800 },
  { model: "1500 kVA 3-Phase Pad-Mount",  kva_rating: 1500,  phase: 3, estimated_cost_usd: 105000, weight_kg: 3800 },
  { model: "2000 kVA 3-Phase Pad-Mount",  kva_rating: 2000,  phase: 3, estimated_cost_usd: 140000, weight_kg: 4800 },
  { model: "2500 kVA 3-Phase Pad-Mount",  kva_rating: 2500,  phase: 3, estimated_cost_usd: 170000, weight_kg: 5600 },
];

export interface TransformerAutoSelection {
  model: TransformerModel;
  quantity: number;
}

/**
 * Auto-select the ideal transformer(s) for a given kVA requirement.
 * Returns null when the farm is small enough to run on existing supply.
 */
export function autoSelectTransformer(kva: number): TransformerAutoSelection | null {
  if (kva < NO_TRANSFORMER_THRESHOLD_KVA) return null;

  const suitable = TRANSFORMERS.find(t => t.kva_rating >= kva);
  if (suitable) return { model: suitable, quantity: 1 };

  // Exceeds largest single unit — use multiples of the largest
  const largest = TRANSFORMERS[TRANSFORMERS.length - 1];
  return { model: largest, quantity: Math.ceil(kva / largest.kva_rating) };
}
