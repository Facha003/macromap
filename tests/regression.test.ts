import { describe, expect, it } from "vitest";
import { resolveBasis, templateBasis } from "@/lib/nutrition/basis";

/**
 * Regression guard for representative meals. If an estimator change moves these
 * numbers on purpose, review the diff, bump ESTIMATOR_VERSION in
 * src/server/nutrition/service.ts, and update the snapshot (vitest -u).
 */
const MEALS: [string, string, Record<string, string | number>?][] = [
  ["Chicken kebab wrap", "Grilled chicken, salad and garlic sauce"],
  ["Kebab plate with rice", "Döner meat with rice, salad and garlic sauce"],
  ["Salmon nigiri (8 pcs)", ""],
  ["California roll (8 pcs)", ""],
  ["Cheeseburger", "Beef patty, cheddar, lettuce, tomato, burger sauce"],
  ["Brown sugar milk tea", "Fresh milk, brown sugar syrup and tapioca pearls"],
  ["Brown sugar milk tea", "Fresh milk, brown sugar syrup and tapioca pearls", { sugar: "25", milk: "oat" }],
  ["Chicken tikka masala", "Served with rice"],
  ["Spaghetti carbonara", ""],
  ["Laks med poteter", "Stekt laks, poteter og smørsaus"],
];

describe("estimator regression", () => {
  it.each(MEALS)("%s", (name, desc, sel) => {
    const e = resolveBasis(templateBasis(name, desc), sel ?? {}).estimate!;
    const r = (x: { min: number; likely: number; max: number }) => [Math.round(x.min), Math.round(x.likely), Math.round(x.max)];
    expect({ kcal: r(e.values.kcal), protein: r(e.values.protein), carbs: r(e.values.carbs), fat: r(e.values.fat) }).toMatchSnapshot();
  });
});
