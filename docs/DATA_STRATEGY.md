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

## Restaurant coverage on GitHub Pages

The public Overpass servers take 30+ seconds per query under load. So the Pages build ships a **daily OpenStreetMap snapshot** of every named restaurant, café, fast-food place, ice-cream shop and food court in Norway (`scripts/build-places.ts`):
- It's split into ~5.5 km tiles, so the browser loads only the tiles around you and the list appears instantly.
- It's one query per day instead of one per visitor.
- Outside the snapshot's area, the app falls back to live Overpass lookups.

## Menus read from restaurants' own websites

About 2,900 of the Norwegian restaurants on OpenStreetMap list their own website. Every night, `scripts/crawl-menus.ts` (run by the Pages workflow) checks a few hundred of them, Oslo first. Each site is re-checked every 14 days.

**Rules it follows:**
- It fetches only the restaurant's own domain, never delivery platforms or social media.
- It obeys `robots.txt` and identifies itself as `MacroMapBot` with a link to this repository.
- It makes at most one request per second per site, reads at most 4 pages per site, uses 15 s timeouts, and skips anything over 2 MB.

**How it extracts a menu, in order:**
1. **schema.org JSON-LD** menu data embedded in the page. This is exact.
2. **GitHub Models** (free AI inside GitHub Actions, using the built-in token, so no key or quota of your own). It may only return dishes whose names appear in the page text, and anything else is dropped. Each run has a fixed budget, and if the free limit is hit the run continues without AI.
3. **The rule-based parser**, accepted only when at least 5 priced dishes come out and most of what it found looks like real dish names.

**What gets stored:** each menu keeps its source URL, check date and method. The app labels these dishes "From their website · checked <date>" and links to the source. Sites that are pure JavaScript, PDF-less image menus, or link only to Wolt can't be read; those restaurants keep showing typical dishes.

## Menus from Wolt, foodora and restaurant websites

MacroMap **does not scrape** Wolt, foodora or any other site:
- **Their terms forbid it.** Both prohibit automated extraction.
- **The menu data is licensed.** It belongs to them and the restaurants.
- **Browsers block it.** Cross-origin rules stop a static site from reading those pages anyway.

Instead:
- **Links:** every restaurant page links to the restaurant on Wolt, on foodora (via search) and to its own website.
- **Paste a menu:** the user copies menu text they can see and pastes it in. `src/lib/menuParse.ts` extracts the dish names, descriptions and prices. The user reviews them before importing, and imports are labelled as user-added. Estimates then run per dish, through the AI when a key is set, otherwise the templates.
- **Real API access** (partner or merchant programmes) would need an agreement with each platform. That belongs on the roadmap, below.

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
