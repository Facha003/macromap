# Reference meals for estimator validation

`meals.json` holds meals whose nutrition is **independently documented**:
- published by the restaurant or chain,
- lab-analysed,
- or weighed and computed by you.

Every entry needs a source. **Never add made-up or remembered values.**

```json
{
  "id": "bk-whopper-no-2026-11",
  "category": "burger",
  "name": "Whopper",
  "description": "Flame-grilled beef patty, tomato, lettuce, mayo, pickles, onion, ketchup, sesame bun",
  "restaurant": "Burger King Norway",
  "selections": { "cheese": "no" },
  "reference": { "kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "servingG": 0 },
  "source": { "type": "restaurant-published", "url": "https://…", "publisher": "Burger King Norge", "retrievedAt": "2026-11-01" },
  "split": "calibration"
}
```

- Categories to start with: `kebab`, `sushi`, `burger` and `boba`, aiming for 20–30 per category.
- Put about a third of each category in `"split": "holdout"`. Tune assumptions only on `calibration`, and report holdout results.
- Run `npm run validate` (template estimator). Add `-- --ai` to also run the AI-assisted estimator if a provider is configured.
