import { describe, expect, it } from "vitest";
import { buildPrompt, extractJson, interpretationToBasis } from "@/server/nutrition/llm/interpret";
import { resolveBasis } from "@/lib/nutrition/basis";

describe("LLM interpretation", () => {
  it("accepts a valid archetype answer and validates selections", () => {
    const b = interpretationToBasis(
      { is_food: true, archetype: "kebab_wrap", selections: { meat: "chicken", sauce: "light", bogus: "x", size: "huge" }, assumptions: ["Typical durum"], main_uncertainty: "Sauce" },
      "gemini",
    );
    expect(b?.kind).toBe("archetype");
    if (b?.kind !== "archetype") return;
    expect(b.known).toEqual({ meat: "chicken" });
    expect(b.defaults).toEqual({ sauce: "light" });
    expect(resolveBasis(b).estimate!.provider).toBe("gemini");
  });

  it("drops unknown ingredient keys and never accepts nutrient numbers", () => {
    const b = interpretationToBasis(
      {
        is_food: true,
        archetype: null,
        components: [
          { food: "rice_white_cooked", role: "base", grams_min: 150, grams_likely: 200, grams_max: 250 },
          { food: "unicorn_meat", role: "protein", grams_min: 1, grams_likely: 2, grams_max: 3 },
          { food: "ref_kebab_pita", role: "base", grams_min: 1, grams_likely: 2, grams_max: 3 },
        ],
        kcal: 99999,
        assumptions: [],
      },
      "groq",
    );
    expect(b?.kind).toBe("components");
    if (b?.kind !== "components") return;
    expect(b.components.map((c) => c.foodKey)).toEqual(["rice_white_cooked"]);
    expect(b.assumptions.join(" ")).toMatch(/unicorn_meat/);
  });

  it("sorts out-of-order and out-of-range grams", () => {
    const b = interpretationToBasis(
      { is_food: true, archetype: null, components: [{ food: "avocado", role: "vegetable", grams_min: 90, grams_likely: 30, grams_max: 99999 }], assumptions: [] },
      "ollama",
    );
    if (b?.kind !== "components") throw new Error("expected components");
    expect(b.components[0].grams).toEqual({ min: 30, likely: 90, max: 1500 });
  });

  it("returns null for malformed output so callers fall back", () => {
    expect(interpretationToBasis({ nonsense: true }, "gemini")).toBeNull();
    expect(interpretationToBasis(null, "gemini")).toBeNull();
    expect(extractJson("not json")).toBeNull();
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("marks non-food as unavailable", () => {
    expect(interpretationToBasis({ is_food: false, assumptions: ["Gift card"] }, "gemini")).toEqual({ kind: "unavailable", reason: "Gift card" });
  });

  it("prompt lists ingredient keys but no nutrient values", () => {
    const { system } = buildPrompt({ name: "x" });
    expect(system).toContain("chicken_fillet_cooked");
    expect(system).not.toMatch(/\d+ kcal/);
  });
});
