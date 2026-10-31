/**
 * Benchmarks the estimator against data/validation/meals.json.
 *   npm run validate
 * Prints per-category metrics for the calibration and holdout splits. With no
 * reference meals it says so — it never fabricates results.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBasis, templateBasis } from "../src/lib/nutrition/basis";
import { computeMetrics, type Nutrient, type ReferenceMeal } from "../src/lib/validation";

const meals = JSON.parse(readFileSync(join(process.cwd(), "data", "validation", "meals.json"), "utf8")) as ReferenceMeal[];
if (!meals.length) {
  console.log("No reference meals yet — the estimator is UNVALIDATED. Add sourced meals to data/validation/meals.json (see its README).");
  process.exit(0);
}

const NUTRIENTS: Nutrient[] = ["kcal", "protein", "carbs", "fat"];
const rows: Record<string, unknown>[] = [];
const unestimated: string[] = [];
const groups = new Map<string, { estimate: ReturnType<typeof resolveBasis>["estimate"]; meal: ReferenceMeal }[]>();

for (const meal of meals) {
  const est = resolveBasis(templateBasis(meal.name, meal.description ?? ""), meal.selections ?? {}).estimate;
  if (!est) {
    unestimated.push(meal.id);
    continue;
  }
  for (const key of [`${meal.split}:${meal.category}`, `${meal.split}:all`]) (groups.get(key) ?? groups.set(key, []).get(key)!).push({ estimate: est, meal });
}

for (const [key, list] of [...groups].sort()) {
  for (const n of NUTRIENTS) {
    const m = computeMetrics(list.map((x) => ({ estimate: x.estimate!.values[n], reference: x.meal.reference[n] })));
    rows.push({ group: key, nutrient: n, n: m.n, MAE: m.mae.toFixed(1), MAPE: `${(m.mape * 100).toFixed(0)}%`, bias: m.bias.toFixed(1), "±20%": `${(m.within20 * 100).toFixed(0)}%`, coverage: `${(m.coverage * 100).toFixed(0)}%` });
  }
}
console.table(rows);
if (unestimated.length) console.log(`No estimate for: ${unestimated.join(", ")}`);
writeFileSync(join(process.cwd(), "data", "validation", "results.json"), JSON.stringify({ ranAt: new Date().toISOString(), meals: meals.length, rows }, null, 2));
