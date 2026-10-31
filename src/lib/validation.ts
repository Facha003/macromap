/**
 * Accuracy metrics for comparing estimates with independently documented
 * reference nutrition (see data/validation/ and scripts/validate-estimator.ts).
 */
import type { Range } from "./nutrition/types";

export type Nutrient = "kcal" | "protein" | "carbs" | "fat";

export interface ReferenceMeal {
  id: string;
  category: string;
  name: string;
  description?: string;
  restaurant?: string;
  /** Selections a customer would state when ordering (optional). */
  selections?: Record<string, string | string[] | number>;
  reference: Record<Nutrient, number> & { servingG?: number };
  source: { type: "restaurant-published" | "lab" | "weighed"; url: string; publisher: string; retrievedAt: string };
  /** calibration: may be used to tune assumptions. holdout: only for final evaluation. */
  split: "calibration" | "holdout";
}

export interface Metrics {
  n: number;
  mae: number;
  /** Mean absolute percentage error, over references > 0. */
  mape: number;
  /** Mean signed error (estimate − reference); negative = underestimates. */
  bias: number;
  /** Share of estimates within ±20 % of the reference. */
  within20: number;
  /** Share of references inside the estimated min–max range. */
  coverage: number;
}

export function computeMetrics(pairs: { estimate: Range; reference: number }[]): Metrics {
  const n = pairs.length;
  if (!n) return { n: 0, mae: NaN, mape: NaN, bias: NaN, within20: NaN, coverage: NaN };
  let abs = 0, signed = 0, pct = 0, pctN = 0, within = 0, covered = 0;
  for (const { estimate, reference } of pairs) {
    const err = estimate.likely - reference;
    abs += Math.abs(err);
    signed += err;
    if (reference > 0) {
      pct += Math.abs(err) / reference;
      pctN++;
      if (Math.abs(err) / reference <= 0.2) within++;
    }
    if (reference >= estimate.min && reference <= estimate.max) covered++;
  }
  return { n, mae: abs / n, mape: pctN ? pct / pctN : NaN, bias: signed / n, within20: pctN ? within / pctN : NaN, coverage: covered / n };
}
