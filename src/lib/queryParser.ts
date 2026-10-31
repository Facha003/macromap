export interface MealFilters {
  text: string;
  maxKcal?: number;
  minKcal?: number;
  minProtein?: number;
  maxDistanceKm?: number;
  vegetarian?: boolean;
  vegan?: boolean;
  halal?: boolean;
  /** With halal: also include "possibly halal" (cuisine-only, unconfirmed) restaurants. */
  halalPossible?: boolean;
  withinBudget?: boolean;
  /** Only dishes from real menus (restaurant website, users, imports) — no generic "typical" dishes. */
  realOnly?: boolean;
  /** Only meals whose whole estimated range meets the limits (not just the most likely value). */
  strict?: boolean;
  sort?: "score" | "protein_density" | "kcal" | "distance" | "protein";
}

/**
 * Turns phrases like "at least 40 g protein under 650 kcal within 3 km" into
 * structured filters. Whatever isn't recognised stays in `text` and is matched
 * against dish, restaurant and cuisine names.
 */
export function parseMealQuery(input: string): MealFilters {
  let s = ` ${input.toLowerCase()} `;
  const f: MealFilters = { text: "" };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], " ");
    }
  };

  take(/(?:within|inside|under|less than|<)\s*(\d+(?:[.,]\d+)?)\s*(km|kilometers?|m|meters?)\b/, (m) => {
    const v = Number(m[1].replace(",", "."));
    f.maxDistanceKm = m[2].startsWith("k") ? v : v / 1000;
  });
  take(/(?:at least|min(?:imum)?|>=|≥|over|more than|above|minst)\s*(\d{1,3})\s*g?\s*(?:of\s+)?(?:protein|prot)\b/, (m) => (f.minProtein = Number(m[1])));
  take(/(\d{1,3})\s*g?\+?\s*(?:of\s+)?protein\b/, (m) => (f.minProtein = Number(m[1])));
  take(/(?:under|below|less than|max(?:imum)?|<=|≤|<|up to|no more than|under)\s*(\d{2,4})\s*(?:k?cal(?:ories)?|kcal)?\b/, (m) => (f.maxKcal = Number(m[1])));
  take(/(\d{2,4})\s*(?:k?cal(?:ories)?|kcal)\s*(?:or less|max)\b/, (m) => (f.maxKcal = Number(m[1])));
  take(/(?:over|more than|at least|above)\s*(\d{3,4})\s*(?:k?cal(?:ories)?|kcal)\b/, (m) => (f.minKcal = Number(m[1])));
  take(/\bhigh[- ]protein\b/, () => {
    f.minProtein ??= 30;
    f.sort = "protein_density";
  });
  take(/\blow[- ]?(?:cal(?:orie)?s?|kcal)\b/, () => (f.maxKcal ??= 500));
  take(/\b(?:in|within|fits?)\s+(?:my\s+)?(?:remaining\s+)?(?:calorie\s+)?budget\b|\bremaining calories\b/, () => (f.withinBudget = true));
  take(/\bvegan\b/, () => (f.vegan = true));
  take(/\bvegetarian\b|\bveggie\b/, () => (f.vegetarian = true));
  take(/\bhalal\b/, () => (f.halal = true));
  take(/\bnearest\b|\bclosest\b/, () => (f.sort = "distance"));

  f.text = s
    .replace(/\b(find|me|show|something|anything|a|an|the|with|and|meal|meals|food|options?|near(?:by)?|me|please|i want|i'd like|for|of|that|has|is|in)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return f;
}
