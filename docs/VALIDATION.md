# Validating estimate accuracy

> **Status: unvalidated.** The benchmark framework exists, but `data/validation/meals.json` contains no reference meals yet. No accuracy figures have been measured, and the app makes no accuracy claims.

## Running the benchmark

1. Add sourced reference meals to `data/validation/meals.json` (format in `data/validation/README.md`).
2. Run `npm run validate`.
   - It prints MAE, MAPE, bias, share within ±20 % and range coverage, per category and per split.
   - It also writes `data/validation/results.json`.
3. Tune assumptions (portion ranges in `src/lib/nutrition/archetypes.ts`, `MODEL_ERROR` in `estimate.ts`) only on the `calibration` split, and report the `holdout` split.
4. When estimates change, update the regression snapshots in `tests/__snapshots__/regression.test.ts.snap` (`npx vitest -u`). Also bump `ESTIMATOR_VERSION` in `src/server/nutrition/service.ts`.

MacroMap does **not** claim a fixed accuracy. To make any claim, measure it.

## Ground truth

Collect dishes where the true value is known independently of the estimator:

1. **Chain-published nutrition** (Norwegian chains with nutrition PDFs). Use the menu name and description exactly as a customer sees them.
2. **Weighed and lab-analysed samples**: buy the dish and weigh its components. For a subset, send it for bomb calorimetry or proximate analysis.
3. **Matvaretabellen composite dishes**, used only as a sanity check. They are averages, not specific restaurants.

Aim for at least 30 dishes per archetype (kebab, sushi, poke, boba, pizza, burger, wok, salad).

## Protocol

For each dish, run the estimator blind on the menu text only. Do this with:

- the template matcher,
- each AI provider (Gemini, Groq, Ollama, Claude),
- and again after answering the customization questions a customer could answer.

Record the likely value, min and max for kcal, protein, carbs and fat.

## Metrics

- **MAPE** of the likely value per nutrient and archetype.
- **Share within ±20 %** of truth. This is the number a "90 %" claim would need to refer to, and only for a stated tolerance.
- **Range coverage**: how often the truth falls inside the min–max range. Target about 80%. If it's much lower, ranges are too narrow and the `MODEL_ERROR` floors in `estimate.ts` or the portion bounds in `archetypes.ts` should widen. If it's near 100% with very wide ranges, they're too cautious.
- **Bias**: mean signed error. Restaurant portions are usually larger than people assume.

## Feeding results back

- Adjust portion ranges in `src/lib/nutrition/archetypes.ts`, keeping a note of the evidence.
- Bump `ESTIMATOR_VERSION` in `src/server/nutrition/service.ts` so cached estimates are recomputed.
- Publish the per-archetype results in the app's "How numbers are made" section before making any accuracy statement.
