import { describe, expect, it } from "vitest";
import { parseMealQuery } from "@/lib/queryParser";
import { presetTargets, scoreMeal, type Goals } from "@/lib/scoring";
import type { NutritionValues } from "@/lib/nutrition/types";

describe("parseMealQuery", () => {
  it("parses the canonical example", () => {
    const f = parseMealQuery("Find me something with at least 40 g protein under 650 calories within 3 km");
    expect(f).toMatchObject({ minProtein: 40, maxKcal: 650, maxDistanceKm: 3 });
    expect(f.text).toBe("");
  });
  it("keeps food words as text and reads diet flags", () => {
    const f = parseMealQuery("vegan sushi under 500 kcal");
    expect(f).toMatchObject({ vegan: true, maxKcal: 500, text: "sushi" });
  });
  it("handles shorthand", () => {
    expect(parseMealQuery("high protein chicken").minProtein).toBe(30);
    expect(parseMealQuery("40g protein kebab")).toMatchObject({ minProtein: 40, text: "kebab" });
    expect(parseMealQuery("halal within 500 m").maxDistanceKm).toBeCloseTo(0.5);
    expect(parseMealQuery("fits my remaining budget").withinBudget).toBe(true);
  });
});

const v = (kcal: number, protein: number, width = 0.2): NutritionValues => ({
  kcal: { min: kcal * (1 - width / 2), likely: kcal, max: kcal * (1 + width / 2) },
  protein: { min: protein, likely: protein, max: protein },
  carbs: { min: 0, likely: 0, max: 0 },
  fat: { min: 0, likely: 0, max: 0 },
  fiber: null,
  sugar: null,
  sodiumMg: null,
});

const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

describe("scoreMeal", () => {
  const cut: Goals = { goalType: "cut", kcalTarget: 1900, proteinG: 160, carbsG: 170, fatG: 60 };
  const bulk: Goals = { goalType: "bulk", kcalTarget: 3200, proteinG: 170, carbsG: 400, fatG: 100 };

  it("cutting prefers a protein-dense meal over the lowest-calorie one", () => {
    const lean = scoreMeal({ values: v(550, 45), status: "estimated", distanceM: 500 }, cut, zero);
    const tiny = scoreMeal({ values: v(250, 6), status: "estimated", distanceM: 500 }, cut, zero);
    expect(lean.score).toBeGreaterThan(tiny.score);
  });

  it("cutting penalises blowing the remaining budget", () => {
    const consumed = { kcal: 1500, protein: 120, carbs: 0, fat: 0 };
    const big = scoreMeal({ values: v(1100, 50), status: "estimated", distanceM: 500 }, cut, consumed);
    const fits = scoreMeal({ values: v(380, 35), status: "estimated", distanceM: 500 }, cut, consumed);
    expect(fits.score).toBeGreaterThan(big.score);
  });

  it("bulking does not punish a large meal", () => {
    const big = scoreMeal({ values: v(1100, 55), status: "estimated", distanceM: 500 }, bulk, zero);
    const small = scoreMeal({ values: v(400, 30), status: "estimated", distanceM: 500 }, bulk, zero);
    expect(big.score).toBeGreaterThan(small.score);
  });

  it("prefers reliable data and closer restaurants, all else equal", () => {
    const a = scoreMeal({ values: v(600, 40, 0), status: "verified", distanceM: 300 }, cut, zero);
    const b = scoreMeal({ values: v(600, 40, 0.6), status: "estimated", distanceM: 3000 }, cut, zero);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("preset targets are internally consistent", () => {
    const t = presetTargets("cut", 2400, 80);
    expect(t.kcalTarget).toBe(1920);
    expect(t.proteinG).toBe(160);
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcalTarget)).toBeLessThan(10);
  });
});
