# Nutrition data strategy

## The problem, stated plainly

- Places APIs (OSM, Google) give names, locations and cuisines. **They do not give menus.**
- Menus change, and most independent restaurants don't publish them in machine-readable form.
- Very few restaurants publish nutrition. Even when they do, portions vary from serving to serving.
- Hidden calories (cooking oil, sauces, sugar syrups) dominate the error.
- Commercial menu and nutrition databases exist, but they are licensed and paid. MacroMap doesn't assume access to them and doesn't scrape.

## Source hierarchy (implemented in `src/server/nutrition/service.ts`)

| Priority | Status shown | Where it comes from | How it gets in |
|---|---|---|---|
| 1 | **Verified** | Numbers published by the restaurant or chain | `POST /api/admin/official` (see `data/official/FORMAT.md`). Requires a `sourceUrl` and `checkedAt` |
| 2 | **Reference data** | Matvaretabellen's analysed average for that kind of dish (e.g. *Sushi, maki, California*), scaled to an assumed portion | Dish templates that use `dish_reference` foods (maki rolls today) |
| 3 | **Estimate** | Ingredients × grams × food-composition data | AI interpretation (Gemini/Groq/Ollama/Claude) or the rule-based template matcher |

Estimates also show a **cross-check**: the Matvaretabellen average for a comparable dish at the same weight. A big gap tells the user, and us, that the portion or sauce assumptions deserve a look.

## How an estimate is computed

1. **Interpret** the menu text. The AI is constrained to:
   - choose a dish template and option IDs (e.g. `kebab_wrap`, `meat: chicken`, `sauce: light`), or
   - list ingredients from a fixed catalog of ~90 keys, each with a gram range (min / likely / max).

   It cannot output nutrient numbers. Its output goes through a Zod schema, unknown keys are dropped (and reported in the assumptions), grams are sorted and clamped, and invalid option IDs are ignored. If the AI is unavailable, rate-limited or returns junk, the template matcher takes over. If nothing matches, the dish shows **no estimate**.
2. **Compute** each nutrient as Σ grams × value per 100 g, using records fetched from Matvaretabellen (and USDA for tapioca). Each record keeps its source ID and URL.
3. **Range**: each ingredient's portion uncertainty is combined in quadrature, so independent errors don't all stack at their worst case. A model-error floor (8–12%) is added for the gap between the database's reference food and the kitchen's actual recipe. These are modelling choices, not measured accuracy.
4. **Refine**: customization answers apply operations to recipe roles (`replaceRole`, `scaleRole`, `add`, `remove`, `scaleAll`). Answering a question tightens that role's range by 50% and removes it from "Still unknown".
5. **Store**: each result is saved in `nutrition_records` with its full basis JSON, so any number can be reproduced and audited. Records are keyed by a hash of the menu text and the estimator version, so editing the menu text re-estimates it.

## Distinguishing facts from assumptions

- Things the menu states are treated as **known**, e.g. "chicken" or "8 pcs".
- Quantities are **assumed**: portion size, sauce amount, oil. They're shown with an "assumed" tag until the user answers.
- Diet flags come from the restaurant where available. Otherwise vegetarian/vegan is inferred from the recipe and labelled as inferred. Halal is never inferred: it requires a restaurant statement (OSM `diet:halal`, or the item's own data).

## Growing coverage realistically

1. **Restaurant-owner portal**: owners claim a listing, upload a menu, and optionally upload lab or recipe-calculated nutrition (Verified).
2. **Chain imports**: many chains operating in Norway publish nutrition. Import these with source URLs through the admin endpoint, after checking each chain's terms.
3. **Community menus**: users add dishes they see (already live, labelled "Added by a user"). Next steps: moderation, de-duplication, and a "menu photo → items" OCR flow with user confirmation.
4. **Licensed data**: evaluate commercial menu APIs once budget allows. The `PlacesProvider` / menu-source split keeps this pluggable.
5. **International**: the food catalog abstraction supports adding national databases (USDA, CoFID, Fineli, Frida) per market. Places are already global.

## Compliance notes

- OSM data is ODbL: attribution is shown in the map, the footer and the profile page. Overpass and Nominatim are called server-side with an identifying User-Agent, results are cached (24 h for places, 7 days for geocoding), and Nominatim is throttled to 1 request per second.
- Google Places (optional) has strict caching rules. Only place IDs may be stored long-term, so keep the 24 h cache or shorter.
- GDPR: no third-party analytics; an anonymous first-party cookie or a Supabase account; data export and deletion in Profile. Only menu text is ever sent to AI providers. On the Gemini free tier, Google may use prompts to improve its products. Menu text isn't personal data, but switch to a paid tier or Ollama if that matters for your deployment.
