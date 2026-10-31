# Official nutrition import format

Only import numbers that a restaurant or chain **publishes itself** (website, nutrition PDF, in-store sheet).
Each row needs the page it came from and the date you checked it. Imported rows get status **Verified**.

```json
[
  {
    "restaurantId": "osm:node/123456789",
    "name": "Exact dish name as on the menu",
    "description": "optional",
    "category": "optional",
    "priceNok": 149,
    "kcal": 540, "protein": 32, "carbs": 48, "fat": 22,
    "fiber": 4, "sugar": 6, "sodiumMg": 980, "servingG": 320,
    "sourceUrl": "https://restaurant.example/nutrition.pdf",
    "checkedAt": "2026-10-31"
  }
]
```

`restaurantId` is the id shown in the restaurant page URL (`/r/<id>`). Run:

```bash
ADMIN_TOKEN=... node scripts/import-official.mjs path/to/file.json http://localhost:3000
```
