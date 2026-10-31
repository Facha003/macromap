import type { FoodKey } from "./catalog";
import type { Component } from "./types";

const MEAT_FISH = new Set<FoodKey>([
  "chicken_fillet_cooked", "chicken_thigh_roasted", "chicken_fillet_fried", "kebab_meat", "beef_mince_fried",
  "beef_patty_raw", "beef_striploin_roasted", "lamb_mince_fried", "salmon_raw", "salmon_roasted", "tuna_raw",
  "king_prawn_raw", "bacon_fried", "pepperoni", "ham_boiled",
  "ref_kebab_pita", "ref_kebab_durum", "ref_nigiri_salmon", "ref_nigiri_tuna", "ref_maki_salmon",
  "ref_maki_california", "ref_burger_single", "ref_cheeseburger", "ref_chicken_burger", "ref_pizza_pepperoni",
  "ref_pad_thai", "ref_chicken_feta_salad",
]);

const OTHER_ANIMAL = new Set<FoodKey>([
  "egg_boiled", "paneer", "halloumi", "cream_18", "croissant", "cinnamon_roll", "mozzarella", "feta", "cheddar", "parmesan", "cream_cheese", "greek_yogurt_10", "milk_whole",
  "milk_semi", "milk_skimmed", "mayonnaise", "garlic_dressing", "tzatziki", "caesar_dressing", "butter", "honey",
  "ref_falafel_pita", "ref_pizza_margherita", "ref_caffe_latte_whole", "ref_greek_salad",
]);

/**
 * Diet compatibility inferred from the *estimated* recipe. This is a hint only —
 * the UI labels it as inferred and never presents it as the restaurant's claim.
 */
export function inferDiet(components: Component[]): { vegetarian: boolean; vegan: boolean } {
  const keys = components.filter((c) => c.grams.likely > 0).map((c) => c.foodKey);
  const vegetarian = !keys.some((k) => MEAT_FISH.has(k));
  const vegan = vegetarian && !keys.some((k) => OTHER_ANIMAL.has(k));
  return { vegetarian, vegan };
}
