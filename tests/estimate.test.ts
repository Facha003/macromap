import { describe, expect, it } from "vitest";
import { resolveBasis, templateBasis } from "@/lib/nutrition/basis";
import { estimateFromComponents, estimateFromOfficial, food } from "@/lib/nutrition/estimate";
import { customize } from "@/lib/nutrition/customize";
import { getArchetype } from "@/lib/nutrition/archetypes";
import { inferDiet } from "@/lib/nutrition/diet";

describe("estimateFromComponents", () => {
  it("computes the likely value exactly from database values", () => {
    const e = estimateFromComponents({
      components: [{ foodKey: "rice_white_cooked", role: "base", grams: { min: 200, likely: 200, max: 200 } }],
      provider: "curated",
      assumptions: [],
      mainUncertainty: null,
    });
    const per100 = food("rice_white_cooked").per100g;
    expect(e.values.kcal.likely).toBeCloseTo(per100.kcal * 2);
    expect(e.values.protein.likely).toBeCloseTo(per100.protein * 2);
    // Even with exact grams an estimate keeps a model-error range.
    expect(e.values.kcal.min).toBeLessThan(e.values.kcal.likely);
    expect(e.values.kcal.max).toBeGreaterThan(e.values.kcal.likely);
    expect(e.status).toBe("estimated");
  });

  it("combines portion uncertainty in quadrature (narrower than worst case)", () => {
    const comps = [
      { foodKey: "rice_white_cooked" as const, role: "base" as const, grams: { min: 100, likely: 200, max: 300 } },
      { foodKey: "chicken_fillet_cooked" as const, role: "protein" as const, grams: { min: 100, likely: 150, max: 200 } },
    ];
    const e = estimateFromComponents({ components: comps, provider: "curated", assumptions: [], mainUncertainty: null });
    const worstMax = (300 * food("rice_white_cooked").per100g.kcal + 200 * food("chicken_fillet_cooked").per100g.kcal) / 100;
    expect(e.values.kcal.max).toBeLessThan(worstMax);
  });

  it("marks recipes made of whole-dish database averages as external reference data", () => {
    const e = estimateFromComponents({
      components: [{ foodKey: "ref_maki_california", role: "base", grams: { min: 160, likely: 200, max: 250 } }],
      provider: "curated",
      assumptions: [],
      mainUncertainty: null,
    });
    expect(e.status).toBe("external");
    expect(e.provider).toBe("reference_db");
  });

  it("official data is verified with a single value", () => {
    const e = estimateFromOfficial({ kcal: 500, protein: 30, carbs: 50, fat: 20, sourceUrl: "https://example.com", checkedAt: "2026-01-01" });
    expect(e.status).toBe("verified");
    expect(e.values.kcal).toEqual({ min: 500, likely: 500, max: 500 });
  });
});

describe("customization", () => {
  it("removing sauce lowers calories and fat", () => {
    const basis = templateBasis("Chicken kebab wrap", "garlic sauce");
    const base = resolveBasis(basis).estimate!;
    const noSauce = resolveBasis(basis, { sauce: "none" }).estimate!;
    expect(noSauce.values.kcal.likely).toBeLessThan(base.values.kcal.likely);
    expect(noSauce.values.fat.likely).toBeLessThan(base.values.fat.likely);
  });

  it("answering a question removes it from unknowns and narrows the range", () => {
    const basis = templateBasis("Chicken kebab wrap", "");
    const before = resolveBasis(basis);
    const after = resolveBasis(basis, { sauce: "regular", size: "regular" });
    expect(before.unknowns).toContain("Sauce quantity");
    expect(after.unknowns).not.toContain("Sauce quantity");
    const w = (r: { min: number; max: number }) => r.max - r.min;
    expect(w(after.estimate!.values.kcal)).toBeLessThan(w(before.estimate!.values.kcal));
  });

  it("piece count scales sushi linearly", () => {
    const basis = templateBasis("Salmon nigiri", "");
    const four = resolveBasis(basis, { pieces: 4 }).estimate!;
    const eight = resolveBasis(basis, { pieces: 8 }).estimate!;
    expect(eight.values.kcal.likely).toBeCloseTo(four.values.kcal.likely * 2, 5);
  });

  it("menu-stated piece counts are treated as known", () => {
    const r = resolveBasis(templateBasis("Salmon nigiri (6 pcs)", ""));
    expect(r.selections.pieces).toBe(6);
    expect(r.unknowns).not.toContain("Number of pieces");
  });

  it("boba sugar level and milk swap change sugar and fat", () => {
    const basis = templateBasis("Brown sugar milk tea", "tapioca pearls");
    const full = resolveBasis(basis, { sugar: "100" }).estimate!;
    const quarter = resolveBasis(basis, { sugar: "25" }).estimate!;
    const oat = resolveBasis(basis, { milk: "oat" }).estimate!;
    expect(quarter.values.sugar!.likely).toBeLessThan(full.values.sugar!.likely);
    expect(oat.values.fat.likely).toBeLessThan(full.values.fat.likely);
  });

  it("replaceRole swaps the protein while keeping grams", () => {
    const a = getArchetype("poke_bowl")!;
    const { components } = customize(a.base, a.options, {}, { protein: "tofu" });
    const p = components.find((c) => c.role === "protein")!;
    expect(p.foodKey).toBe("tofu");
    expect(p.grams.likely).toBe(a.base.find((c) => c.role === "protein")!.grams.likely);
  });
});

describe("template matching", () => {
  it.each([
    ["Chicken kebab wrap", "kebab_wrap"],
    ["Döner kebab in pita", "kebab_pita"],
    ["Kebab tallerken", "kebab_plate"],
    ["California roll (8 pcs)", "sushi_maki"],
    ["Salmon poke bowl", "poke_bowl"],
    ["Passion fruit green tea with pearls", "boba"],
    ["Pepperoni pizza", "pizza"],
    ["Pad thai", "noodles"],
  ])("%s → %s", (name, id) => {
    const b = templateBasis(name, "");
    expect(b.kind).toBe("archetype");
    if (b.kind === "archetype") expect(b.archetypeId).toBe(id);
  });

  it("does not guess unknown dishes", () => {
    expect(templateBasis("Chef's surprise", "").kind).toBe("unavailable");
  });

  it("'no cheese' means no cheese", () => {
    const r = resolveBasis(templateBasis("Grilled chicken burger", "lettuce, tomato, mayo — no cheese"));
    expect(r.estimate!.components.some((c) => c.role === "cheese")).toBe(false);
  });

  it("pepperoni does not trigger the peppers topping", () => {
    const r = resolveBasis(templateBasis("Pepperoni pizza", ""));
    expect(r.estimate!.components.some((c) => c.foodKey === "sweet_pepper")).toBe(false);
  });
});

describe("diet inference", () => {
  it("detects vegetarian vs vegan", () => {
    const falafel = resolveBasis(templateBasis("Falafel wrap", "")).estimate!;
    expect(inferDiet(falafel.components)).toEqual({ vegetarian: true, vegan: true });
    const kebab = resolveBasis(templateBasis("Kebab pita", "")).estimate!;
    expect(inferDiet(kebab.components).vegetarian).toBe(false);
  });
});

describe("name-first matching", () => {
  it("a veggie burger with a falafel patty is a burger", () => {
    const b = templateBasis("Veggie burger", "Falafel patty, lettuce, tomato, vegan mayo");
    expect(b.kind === "archetype" && b.archetypeId).toBe("burger");
  });
  it("size words in the description are not a portion size", () => {
    const b = templateBasis("Chicken kebab wrap", "grilled chicken in a large wrap");
    expect(b.kind === "archetype" && b.defaults.size).toBeUndefined();
    const big = templateBasis("Large chicken kebab wrap", "");
    expect(big.kind === "archetype" && big.defaults.size).toBe("large");
  });
});
