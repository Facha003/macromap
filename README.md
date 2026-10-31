# MacroMap

Find restaurant meals near you that fit your calories and macros, with nutrition numbers that tell you where they came from and how sure they are.

- **Explore**: nearby restaurants from OpenStreetMap on a map or list, with an adjustable radius and manual location entry.
- **Restaurant menus**: each dish shows nutrition with a provenance label: *Verified* (published by the restaurant), *Reference data* (a Matvaretabellen dish average) or *Estimate*.
- **Customize**: choose meat, size, sauce, sugar %, milk, piece count and so on. The range updates live and narrows as you answer.
- **Search**: free text like `at least 40 g protein under 650 kcal within 3 km`, plus filter chips. Results are ranked by fit to your goal.
- **Compare**: put up to 4 dishes side by side, including protein per 100 kcal and per 100 kr.
- **Diary**: log a meal in two taps. Shows calorie and macro progress, lets you edit portions, repeat meals and browse 7-day history.
- **Goals**: cutting / bulking / maintenance / healthy / custom, with suggested targets.
- **Privacy**: export or delete your data. Location never leaves the browser except as search coordinates.

## Run it on GitHub (no install)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Facha003/macromap?quickstart=1)

Click the badge (or **Code → Codespaces → Create codespace on main**). GitHub installs everything and starts the app; a browser tab opens on the running app after ~2 minutes. If it doesn't, open the **Ports** tab and click the globe next to port 3000.

Optional: add `GEMINI_API_KEY` (and `CONTACT_EMAIL`) as [Codespaces secrets](https://github.com/settings/codespaces) for AI estimates of any dish.

Codespaces is free for a monthly quota of hours on personal accounts and stops automatically when idle. For a permanent public URL, deploy to Vercel + Supabase (below).

## Quick start

```bash
npm install            # also copies the MapLibre worker into /public
npm run dev            # http://localhost:3000
```

No accounts or keys are needed. Locally the app uses an embedded Postgres (PGlite in `.data/pglite`), which migrates and seeds itself on first request. It also uses OpenStreetMap for places and template-based estimates. Seven fictional **demo** restaurants in Oslo are seeded and clearly labelled.

Recommended: copy `.env.example` to `.env.local` and set:

| Variable | Why |
|---|---|
| `CONTACT_EMAIL` | Required by the OpenStreetMap Overpass/Nominatim usage policies |
| `GEMINI_API_KEY` | Free AI ingredient analysis for any dish ([get a key](https://aistudio.google.com/apikey)). Alternatives: `GROQ_API_KEY` (free tier), `OLLAMA_URL` (local, free forever), `ANTHROPIC_API_KEY` (paid) |

Other commands:

```bash
npm test               # unit tests (estimator, customization, scoring, parser, AI validation)
npm run typecheck
npm run build && npm start
npm run seed:foods     # re-fetch food-composition data → data/foods.snapshot.json
npm run db:migrate     # apply migrations (PGlite, or DATABASE_URL)
npm run db:seed        # upsert foods + demo restaurants (add -- --no-demo to skip demo)
npm run db:generate    # new migration after editing src/server/db/schema.ts
```

## Deploying (Vercel + Supabase)

1. Create a Supabase project. Copy the **transaction pooler** connection string (port 6543) into `DATABASE_URL`.
2. Run `DATABASE_URL=... npm run db:migrate && DATABASE_URL=... npm run db:seed -- --no-demo`. Leave off `--no-demo` if you want the demo restaurants.
3. In the Supabase SQL editor, run `supabase/policies.sql` (row-level security).
4. Optional accounts: enable Email auth. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and add `https://<your-domain>/auth/callback` to the redirect URLs. Without these, users get an anonymous first-party cookie ID.
5. Deploy to Vercel with the same env vars, plus `CONTACT_EMAIL`, an AI key and `ADMIN_TOKEN`.

Any Node host works too (`npm run build && npm start`). PGlite is fine for a single-instance demo. Use `DATABASE_URL` for anything real.

## Architecture

```
src/
  lib/nutrition/      shared (server + browser) pure logic
    catalog.ts        ingredient keys → Matvaretabellen / USDA record IDs (no numbers)
    estimate.ts       grams × per-100 g composition → nutrient ranges
    customize.ts      option groups as operations on recipe roles
    archetypes.ts     14 dish templates (kebab, sushi, poke, boba, pizza, burger…)
    basis.ts          EstimateBasis → estimate; rule-based template matcher
    diet.ts           vegetarian/vegan inference from the recipe (labelled as inferred)
  lib/scoring.ts      goal-aware meal ranking
  lib/queryParser.ts  "40 g protein under 650 kcal within 3 km" → filters
  server/
    places/           PlacesProvider: OSM Overpass (default), Google Places; Nominatim geocoding
    nutrition/        service (priority: verified → cached AI → AI → template), llm/ providers
    repo/             menu + user data access
    db/               Drizzle schema (Postgres), PGlite/Supabase client, seed
  app/                Next.js App Router pages, API routes, server actions
data/foods.snapshot.json   fetched food-composition records with source IDs
data/demo/oslo.json        demo restaurants: names, descriptions, prices only
drizzle/                   SQL migrations (shared by PGlite and Supabase)
```

**Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, Drizzle ORM with Postgres (PGlite locally, Supabase in production), MapLibre GL with OpenFreeMap tiles, Zod, Vitest.

How the nutrition pipeline works is documented in [docs/DATA_STRATEGY.md](docs/DATA_STRATEGY.md). How estimates should be validated is in [docs/VALIDATION.md](docs/VALIDATION.md).

## Honesty rules (enforced in code)

- Every number carries a status and a source. Only restaurant-published data is *Verified*, and only verified data is shown as a single number.
- The AI never produces nutrient values. It picks ingredients and gram ranges from a fixed catalog; nutrients are computed from Matvaretabellen/USDA records. Its output is schema-validated, and unknown ingredients are dropped and reported.
- Dishes that can't be grounded show "No estimate" rather than a guess.
- Demo restaurants are fictional and labelled everywhere, but their nutrition still runs through the real estimator.
- No accuracy percentage is claimed. See the validation plan.

## Licences and attribution

- Food composition: **Matvaretabellen**, Norwegian Food Safety Authority (CC BY 4.0); **USDA FoodData Central** (public domain).
- Places, geocoding and map data: © **OpenStreetMap** contributors (ODbL). Tiles by **OpenFreeMap** / OpenMapTiles.
- Google Places (optional) is subject to Google's terms, including restrictions on caching and display.
