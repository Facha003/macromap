import { describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/validation";

// Synthetic numbers — these test the metric arithmetic only, not the estimator.
describe("computeMetrics", () => {
  it("computes MAE, MAPE, bias, ±20 % and coverage", () => {
    const m = computeMetrics([
      { estimate: { min: 400, likely: 500, max: 600 }, reference: 450 },
      { estimate: { min: 700, likely: 800, max: 900 }, reference: 1000 },
    ]);
    expect(m.n).toBe(2);
    expect(m.mae).toBe(125);
    expect(m.bias).toBe(-75);
    expect(m.mape).toBeCloseTo((50 / 450 + 200 / 1000) / 2);
    expect(m.within20).toBe(1);
    expect(m.coverage).toBe(0.5);
  });

  it("returns NaN metrics for no data instead of inventing them", () => {
    expect(Number.isNaN(computeMetrics([]).mae)).toBe(true);
  });
});
