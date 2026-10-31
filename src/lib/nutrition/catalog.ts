/**
 * Ingredient catalog: every key maps to ONE record in a public food-composition
 * database. Nutrient values are never typed in here — `npm run seed:foods`
 * fetches them from the source and writes data/foods.snapshot.json.
 *
 * mvt  = Matvaretabellen (Norwegian Food Safety Authority), CC BY 4.0
 * usda = USDA FoodData Central (public domain)
 */

export type FoodSourceDb = "mvt" | "usda";

export type FoodGroup =
  | "protein"
  | "carb"
  | "vegetable"
  | "dairy"
  | "sauce"
  | "fat"
  | "drink"
  | "sweetener"
  | "dish_reference";

export interface CatalogEntry {
  source: FoodSourceDb;
  id: string;
  label: string;
  group: FoodGroup;
}

export const FOOD_CATALOG = {
  // Proteins
  chicken_fillet_cooked: { source: "mvt", id: "03.481", label: "Chicken breast fillet, cooked", group: "protein" },
  chicken_thigh_roasted: { source: "mvt", id: "03.394", label: "Chicken thigh, skinless, roasted", group: "protein" },
  chicken_fillet_fried: { source: "mvt", id: "03.242", label: "Chicken fillet, fried in fat", group: "protein" },
  kebab_meat: { source: "mvt", id: "03.497", label: "Kebab meat, restaurant-prepared", group: "protein" },
  beef_mince_fried: { source: "mvt", id: "03.138", label: "Beef mince, fried", group: "protein" },
  beef_patty_raw: { source: "mvt", id: "03.132", label: "Hamburger patty, raw", group: "protein" },
  beef_striploin_roasted: { source: "mvt", id: "03.271", label: "Beef striploin, roasted", group: "protein" },
  lamb_mince_fried: { source: "mvt", id: "03.480", label: "Lamb mince, fried", group: "protein" },
  salmon_raw: { source: "mvt", id: "04.220", label: "Salmon, farmed, raw", group: "protein" },
  salmon_roasted: { source: "mvt", id: "04.342", label: "Salmon fillet, roasted", group: "protein" },
  tuna_raw: { source: "mvt", id: "04.333", label: "Tuna, sashimi", group: "protein" },
  king_prawn_raw: { source: "mvt", id: "04.340", label: "King prawns", group: "protein" },
  tofu: { source: "mvt", id: "06.704", label: "Tofu", group: "protein" },
  falafel: { source: "mvt", id: "06.783", label: "Falafel", group: "protein" },
  egg_boiled: { source: "mvt", id: "02.026", label: "Egg, boiled", group: "protein" },
  bacon_fried: { source: "mvt", id: "03.509", label: "Bacon, pan-fried", group: "protein" },
  pepperoni: { source: "mvt", id: "03.475", label: "Pepperoni", group: "protein" },
  ham_boiled: { source: "mvt", id: "03.106", label: "Ham, boiled", group: "protein" },
  edamame: { source: "mvt", id: "06.197", label: "Edamame", group: "protein" },
  chickpeas_boiled: { source: "mvt", id: "06.213", label: "Chickpeas, boiled", group: "protein" },
  lentils_cooked: { source: "mvt", id: "06.105", label: "Lentils, cooked", group: "protein" },
  paneer: { source: "mvt", id: "01.301", label: "Paneer", group: "protein" },
  halloumi: { source: "mvt", id: "01.270", label: "Halloumi", group: "protein" },

  // Carbohydrate bases
  rice_white_cooked: { source: "mvt", id: "05.289", label: "White rice, cooked", group: "carb" },
  sushi_rice_cooked: { source: "mvt", id: "05.521", label: "Sushi rice, cooked", group: "carb" },
  pita_bread: { source: "mvt", id: "05.188", label: "Pita bread", group: "carb" },
  tortilla_wheat: { source: "mvt", id: "05.381", label: "Wheat tortilla", group: "carb" },
  burger_bun: { source: "mvt", id: "05.061", label: "Hamburger bun", group: "carb" },
  pizza_crust: { source: "mvt", id: "05.062", label: "Pizza crust", group: "carb" },
  noodles_wheat_cooked: { source: "mvt", id: "05.243", label: "Wheat noodles, cooked", group: "carb" },
  rice_noodles_cooked: { source: "mvt", id: "05.334", label: "Rice noodles, cooked", group: "carb" },
  bulgur_cooked: { source: "mvt", id: "05.285", label: "Bulgur, cooked", group: "carb" },
  quinoa_cooked: { source: "mvt", id: "06.616", label: "Quinoa, cooked", group: "carb" },
  french_fries: { source: "mvt", id: "06.738", label: "French fries, fast-food", group: "carb" },
  croissant: { source: "mvt", id: "05.312", label: "Croissant", group: "carb" },
  cinnamon_roll: { source: "mvt", id: "05.187", label: "Cinnamon roll (kanelbolle)", group: "carb" },
  sweet_potato_roasted: { source: "mvt", id: "06.229", label: "Sweet potato, roasted", group: "carb" },
  tapioca_pearl_dry: { source: "usda", id: "169717", label: "Tapioca pearls (dry weight)", group: "carb" },

  // Vegetables & fruit
  lettuce_iceberg: { source: "mvt", id: "06.059", label: "Iceberg lettuce", group: "vegetable" },
  tomato_raw: { source: "mvt", id: "06.753", label: "Tomato", group: "vegetable" },
  cucumber: { source: "mvt", id: "06.010", label: "Cucumber", group: "vegetable" },
  onion_raw: { source: "mvt", id: "06.042", label: "Onion", group: "vegetable" },
  red_cabbage: { source: "mvt", id: "06.093", label: "Red cabbage", group: "vegetable" },
  avocado: { source: "mvt", id: "06.524", label: "Avocado", group: "vegetable" },
  sweet_pepper: { source: "mvt", id: "06.047", label: "Sweet pepper", group: "vegetable" },
  jalapeno: { source: "mvt", id: "06.125", label: "Jalapeño", group: "vegetable" },
  broccoli_cooked: { source: "mvt", id: "06.725", label: "Broccoli, cooked", group: "vegetable" },
  mushroom: { source: "mvt", id: "06.062", label: "Mushroom", group: "vegetable" },
  spring_onion: { source: "mvt", id: "06.113", label: "Spring onion", group: "vegetable" },
  carrot: { source: "mvt", id: "06.036", label: "Carrot", group: "vegetable" },
  olives_black: { source: "mvt", id: "06.611", label: "Black olives", group: "vegetable" },
  pickled_cucumber: { source: "mvt", id: "06.076", label: "Pickled cucumber", group: "vegetable" },
  nori: { source: "mvt", id: "06.139", label: "Nori seaweed", group: "vegetable" },
  hummus: { source: "mvt", id: "06.679", label: "Hummus", group: "vegetable" },
  spinach: { source: "mvt", id: "06.285", label: "Spinach", group: "vegetable" },
  coconut_milk: { source: "mvt", id: "06.701", label: "Coconut milk, canned", group: "sauce" },
  banana: { source: "mvt", id: "06.525", label: "Banana", group: "vegetable" },

  // Dairy & plant milks
  mozzarella: { source: "mvt", id: "01.297", label: "Mozzarella", group: "dairy" },
  feta: { source: "mvt", id: "01.188", label: "Feta", group: "dairy" },
  cheddar: { source: "mvt", id: "01.027", label: "Cheddar", group: "dairy" },
  parmesan: { source: "mvt", id: "01.200", label: "Parmesan", group: "dairy" },
  cream_cheese: { source: "mvt", id: "01.269", label: "Cream cheese", group: "dairy" },
  greek_yogurt_10: { source: "mvt", id: "01.335", label: "Greek yoghurt, 10% fat", group: "dairy" },
  milk_whole: { source: "mvt", id: "01.236", label: "Whole milk", group: "dairy" },
  milk_semi: { source: "mvt", id: "01.229", label: "Semi-skimmed milk, 1%", group: "dairy" },
  milk_skimmed: { source: "mvt", id: "01.003", label: "Skimmed milk", group: "dairy" },
  oat_drink: { source: "mvt", id: "13.125", label: "Oat drink", group: "dairy" },

  // Sauces & condiments
  mayonnaise: { source: "mvt", id: "08.009", label: "Mayonnaise, full-fat", group: "sauce" },
  garlic_dressing: { source: "mvt", id: "01.180", label: "Sour-cream garlic/herb dressing", group: "sauce" },
  tzatziki: { source: "mvt", id: "06.673", label: "Tzatziki", group: "sauce" },
  sweet_chili_sauce: { source: "mvt", id: "10.177", label: "Sweet chili sauce", group: "sauce" },
  soy_sauce: { source: "mvt", id: "10.126", label: "Soy sauce", group: "sauce" },
  teriyaki_sauce: { source: "mvt", id: "10.179", label: "Teriyaki sauce", group: "sauce" },
  ketchup: { source: "mvt", id: "06.079", label: "Ketchup", group: "sauce" },
  tomato_canned: { source: "mvt", id: "06.070", label: "Tomato sauce base (canned tomato)", group: "sauce" },
  caesar_dressing: { source: "mvt", id: "08.257", label: "Caesar dressing", group: "sauce" },
  tahini: { source: "mvt", id: "06.702", label: "Tahini", group: "sauce" },

  // Fats & seeds
  oil_rapeseed: { source: "mvt", id: "08.235", label: "Rapeseed oil", group: "fat" },
  oil_olive: { source: "mvt", id: "08.019", label: "Olive oil", group: "fat" },
  oil_sesame: { source: "mvt", id: "08.105", label: "Sesame oil", group: "fat" },
  butter: { source: "mvt", id: "08.237", label: "Butter", group: "fat" },
  peanuts_roasted: { source: "mvt", id: "06.558", label: "Peanuts, roasted", group: "fat" },
  cashews: { source: "mvt", id: "06.582", label: "Cashew nuts", group: "fat" },
  cream_18: { source: "mvt", id: "01.175", label: "Cream, 18% fat", group: "dairy" },
  sesame_seeds: { source: "mvt", id: "05.147", label: "Sesame seeds", group: "fat" },

  // Drinks & sweeteners
  tea_black: { source: "mvt", id: "13.010", label: "Black tea", group: "drink" },
  tea_green: { source: "mvt", id: "13.042", label: "Green tea", group: "drink" },
  coffee: { source: "mvt", id: "13.009", label: "Coffee", group: "drink" },
  cola: { source: "mvt", id: "13.045", label: "Cola, with sugar", group: "drink" },
  sugar_white: { source: "mvt", id: "09.002", label: "Sugar / sugar syrup (dry weight)", group: "sweetener" },
  sugar_brown: { source: "mvt", id: "09.001", label: "Brown sugar (dry weight)", group: "sweetener" },
  honey: { source: "mvt", id: "09.003", label: "Honey", group: "sweetener" },

  // Whole-dish references (database averages for comparable dishes)
  ref_kebab_pita: { source: "mvt", id: "03.510", label: "Pita with kebab, salad and dressing", group: "dish_reference" },
  ref_kebab_durum: { source: "mvt", id: "03.508", label: "Kebab dürüm", group: "dish_reference" },
  ref_falafel_pita: { source: "mvt", id: "10.222", label: "Pita with falafel, salad and dressing", group: "dish_reference" },
  ref_nigiri_salmon: { source: "mvt", id: "04.334", label: "Sushi, nigiri, salmon", group: "dish_reference" },
  ref_nigiri_tuna: { source: "mvt", id: "04.336", label: "Sushi, nigiri, tuna", group: "dish_reference" },
  ref_maki_salmon: { source: "mvt", id: "04.337", label: "Sushi, maki, salmon", group: "dish_reference" },
  ref_maki_california: { source: "mvt", id: "04.368", label: "Sushi, maki, California", group: "dish_reference" },
  ref_maki_avocado: { source: "mvt", id: "06.786", label: "Sushi, maki, avocado", group: "dish_reference" },
  ref_burger_single: { source: "mvt", id: "03.308", label: "Burger, single, fast-food restaurant", group: "dish_reference" },
  ref_cheeseburger: { source: "mvt", id: "03.309", label: "Cheeseburger, single, fast-food restaurant", group: "dish_reference" },
  ref_chicken_burger: { source: "mvt", id: "03.312", label: "Chicken burger, breaded, fast-food restaurant", group: "dish_reference" },
  ref_pizza_margherita: { source: "mvt", id: "06.734", label: "Pizza, tomato sauce and cheese, home-made", group: "dish_reference" },
  ref_pizza_pepperoni: { source: "mvt", id: "10.181", label: "Pizza, pepperoni, home-made", group: "dish_reference" },
  ref_caffe_latte_whole: { source: "mvt", id: "13.040", label: "Caffè latte, whole milk", group: "dish_reference" },
  ref_caffe_latte_oat: { source: "mvt", id: "13.127", label: "Caffè latte, oat drink", group: "dish_reference" },
  ref_pad_thai: { source: "mvt", id: "10.224", label: "Pad thai with shrimp", group: "dish_reference" },
  ref_greek_salad: { source: "mvt", id: "06.712", label: "Greek salad with feta and olives", group: "dish_reference" },
  ref_chicken_feta_salad: { source: "mvt", id: "10.205", label: "Salad with chicken and feta, café", group: "dish_reference" },
} as const satisfies Record<string, CatalogEntry>;

export type FoodKey = keyof typeof FOOD_CATALOG;

export const FOOD_KEYS = Object.keys(FOOD_CATALOG) as FoodKey[];

/** Ingredient keys an estimator (AI or template) may use — excludes whole-dish references. */
export const INGREDIENT_KEYS = FOOD_KEYS.filter(
  (k) => FOOD_CATALOG[k].group !== "dish_reference",
);

export function isFoodKey(k: string): k is FoodKey {
  return Object.prototype.hasOwnProperty.call(FOOD_CATALOG, k);
}

export function sourceUrl(entry: CatalogEntry): string {
  return entry.source === "mvt"
    ? `https://www.matvaretabellen.no/en/search/?search=${encodeURIComponent(entry.id)}`
    : `https://fdc.nal.usda.gov/food-details/${entry.id}/nutrients`;
}
