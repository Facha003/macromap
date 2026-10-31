/**
 * Dish archetypes: a typical recipe (portion ranges in grams) plus the questions
 * a user can answer to refine it. Portion ranges are modelling assumptions about
 * typical restaurant servings in Norway, stated openly in `assumptions` — they
 * are NOT measured values for any specific restaurant. Nutrient values always
 * come from the food database (see catalog.ts).
 */
import type { FoodKey } from "./catalog";
import type { Component, Range, Role } from "./types";
import type { OptionChoice, OptionGroup, Selections } from "./customize";

const g = (min: number, likely: number, max: number): Range => ({ min, likely, max });
const c = (foodKey: FoodKey, role: Role, grams: Range, note?: string): Component => ({ foodKey, role, grams, ...(note ? { note } : {}) });

export interface Archetype {
  id: string;
  label: string;
  /** Lower-case regexes matched against "name + description". First match wins (list order). */
  match: RegExp[];
  base: Component[];
  options: OptionGroup[];
  referenceKey?: FoodKey;
  assumptions: string[];
  mainUncertainty: string;
  /**
   * Infers default selections from menu text, e.g. "chicken" → meat: chicken.
   * `name` is the dish name alone — size words are only trusted there
   * ("in a large wrap" in a description is not a size).
   */
  infer?: (text: string, name: string) => Selections;
}

// ---------- shared option groups ----------

const sizeGroup = (small = 0.75, large = 1.35, unknownLabel = "Portion size"): OptionGroup => ({
  id: "size",
  label: "Size",
  kind: "single",
  defaultChoice: "regular",
  unknownLabel,
  narrows: "all",
  choices: [
    { id: "small", label: "Small", ops: [{ type: "scaleAll", factor: small }] },
    { id: "regular", label: "Regular", ops: [] },
    { id: "large", label: "Large", ops: [{ type: "scaleAll", factor: large }] },
  ],
});

const sauceGroup = (unknownLabel = "Sauce quantity"): OptionGroup => ({
  id: "sauce",
  label: "Sauce",
  kind: "single",
  defaultChoice: "regular",
  unknownLabel,
  narrows: ["sauce"],
  choices: [
    { id: "none", label: "None", ops: [{ type: "remove", role: "sauce" }] },
    { id: "light", label: "Light", ops: [{ type: "scaleRole", role: "sauce", factor: 0.5 }] },
    { id: "regular", label: "Regular", ops: [] },
    { id: "extra", label: "Extra", ops: [{ type: "scaleRole", role: "sauce", factor: 1.7 }] },
  ],
});

const extraProteinGroup = (label = "Extra meat"): OptionGroup => ({
  id: "extras_protein",
  label: "Add-ons",
  kind: "multi",
  choices: [{ id: "extra_protein", label, ops: [{ type: "scaleRole", role: "protein", factor: 1.5 }] }],
});

const oilGroup: OptionGroup = {
  id: "oil",
  label: "Cooking oil",
  kind: "single",
  defaultChoice: "regular",
  unknownLabel: "Cooking oil",
  narrows: ["fat"],
  choices: [
    { id: "light", label: "Light", ops: [{ type: "scaleRole", role: "fat", factor: 0.5 }] },
    { id: "regular", label: "Typical", ops: [] },
    { id: "heavy", label: "Oily", ops: [{ type: "scaleRole", role: "fat", factor: 1.7 }] },
  ],
};

const piecesFromText = (text: string, fallback: number): number => {
  const m = text.match(/(\d{1,2})\s*(?:pcs|pieces|piece|stk|biter|bitar|pc)\b/);
  return m ? Number(m[1]) : fallback;
};

const has = (text: string, re: RegExp) => re.test(text);

// ---------- kebab family ----------

const kebabMeat = (amount: Range): OptionGroup => ({
  id: "meat",
  label: "Meat",
  kind: "single",
  defaultChoice: "doner",
  unknownLabel: "Meat type",
  choices: [
    { id: "chicken", label: "Chicken", ops: [{ type: "replaceRole", role: "protein", foodKey: "chicken_thigh_roasted", extra: [c("oil_rapeseed", "fat", g(3, 6, 12), "grill fat / marinade")] }] },
    { id: "doner", label: "Döner (beef/lamb)", ops: [{ type: "replaceRole", role: "protein", foodKey: "kebab_meat" }] },
    { id: "mixed", label: "Mixed", ops: [{ type: "replaceRole", role: "protein", foodKey: "kebab_meat", gramsFactor: 0.5, extra: [c("chicken_thigh_roasted", "protein", { min: amount.min / 2, likely: amount.likely / 2, max: amount.max / 2 }), c("oil_rapeseed", "fat", g(2, 3, 6))] }] },
  ],
});

const kebabInfer = (text: string, name = text): Selections => {
  const s: Selections = {};
  if (has(text, /chicken|kylling/)) s.meat = "chicken";
  else if (has(text, /mix/)) s.meat = "mixed";
  if (has(name, /\b(large|stor|xl)\b/)) s.size = "large";
  if (has(name, /\b(small|liten|mini)\b/)) s.size = "small";
  if (has(text, /no sauce|uten saus/)) s.sauce = "none";
  return s;
};

const kebabSalad = [
  c("lettuce_iceberg", "vegetable", g(20, 35, 50)),
  c("tomato_raw", "vegetable", g(15, 30, 45)),
  c("cucumber", "vegetable", g(10, 20, 35)),
  c("onion_raw", "vegetable", g(5, 15, 25)),
  c("red_cabbage", "vegetable", g(0, 15, 30)),
];

const kebabMeatRange = g(100, 140, 190);

const kebabWrap: Archetype = {
  id: "kebab_wrap",
  label: "Kebab wrap / dürüm",
  match: [/(kebab|kebap|döner|doner|shawarma|gyros?).*(wrap|dürüm|durum|rull)|(wrap|dürüm|durum|rull).*(kebab|döner|doner|shawarma|kylling|chicken)/],
  base: [
    c("tortilla_wheat", "base", g(70, 90, 115), "large wheat wrap / lavash"),
    c("kebab_meat", "protein", kebabMeatRange),
    ...kebabSalad,
    c("garlic_dressing", "sauce", g(25, 50, 85)),
  ],
  options: [kebabMeat(kebabMeatRange), sizeGroup(0.75, 1.35), sauceGroup(), extraProteinGroup()],
  referenceKey: "ref_kebab_durum",
  assumptions: [
    "Kebab meat values are Matvaretabellen's average for restaurant-prepared kebab meat.",
    "Garlic sauce modelled as a sour-cream herb dressing; mayonnaise-heavy sauces are higher in fat.",
    "Wrap weight assumes a large wheat lavash/tortilla.",
  ],
  mainUncertainty: "Sauce quantity and meat portion",
  infer: kebabInfer,
};

const kebabPita: Archetype = {
  ...kebabWrap,
  id: "kebab_pita",
  label: "Kebab in pita",
  match: [/(kebab|döner|doner|shawarma|gyros?).*pita|pita.*(kebab|döner|doner|shawarma|gyros?)/],
  base: [
    c("pita_bread", "base", g(65, 85, 105)),
    c("kebab_meat", "protein", g(90, 130, 170)),
    ...kebabSalad,
    c("garlic_dressing", "sauce", g(25, 45, 80)),
  ],
  options: [kebabMeat(g(90, 130, 170)), sizeGroup(0.75, 1.35), sauceGroup(), extraProteinGroup()],
  referenceKey: "ref_kebab_pita",
};

const kebabPlate: Archetype = {
  id: "kebab_plate",
  label: "Kebab plate",
  match: [/(kebab|döner|doner|shawarma|gyros?).*(plate|tallerken|platter|tallrik|box)|(plate|tallerken|platter).*(kebab|döner|doner|shawarma)/],
  base: [
    c("kebab_meat", "protein", g(150, 200, 260)),
    c("rice_white_cooked", "base", g(150, 220, 300)),
    ...kebabSalad.map((x) => ({ ...x, grams: { min: x.grams.min * 1.5, likely: x.grams.likely * 1.5, max: x.grams.max * 1.5 } })),
    c("garlic_dressing", "sauce", g(35, 60, 100)),
  ],
  options: [
    kebabMeat(g(150, 200, 260)),
    {
      id: "side",
      label: "Side",
      kind: "single",
      defaultChoice: "rice",
      unknownLabel: "Side dish",
      choices: [
        { id: "rice", label: "Rice", ops: [] },
        { id: "fries", label: "Fries", ops: [{ type: "replaceRole", role: "base", foodKey: "french_fries", gramsFactor: 0.8 }] },
        { id: "both", label: "Rice + fries", ops: [{ type: "scaleRole", role: "base", factor: 0.6 }, { type: "add", component: c("french_fries", "side", g(70, 100, 140)) }] },
        { id: "bread", label: "Bread", ops: [{ type: "replaceRole", role: "base", foodKey: "pita_bread", gramsFactor: 0.4 }] },
        { id: "salad", label: "Extra salad", ops: [{ type: "remove", role: "base" }, { type: "scaleRole", role: "vegetable", factor: 1.6 }] },
      ],
    },
    sizeGroup(0.75, 1.3),
    sauceGroup(),
    extraProteinGroup(),
  ],
  assumptions: [
    "Kebab meat values are Matvaretabellen's average for restaurant-prepared kebab meat.",
    "Rice modelled as plain boiled rice; buttered or oiled rice adds fat.",
  ],
  mainUncertainty: "Meat and side portion, sauce quantity",
  infer: (t, name) => {
    const s = kebabInfer(t, name);
    if (has(t, /fries|pommes|chips/)) s.side = has(t, /rice|ris/) ? "both" : "fries";
    return s;
  },
};

const falafelWrap: Archetype = {
  id: "falafel_wrap",
  label: "Falafel wrap / pita",
  match: [/falafel/],
  base: [
    c("tortilla_wheat", "base", g(65, 85, 110)),
    c("falafel", "protein", g(80, 120, 160), "4–6 balls"),
    c("hummus", "sauce", g(15, 35, 60)),
    c("tahini", "sauce", g(5, 12, 25)),
    ...kebabSalad,
  ],
  options: [
    {
      id: "bread",
      label: "Bread",
      kind: "single",
      defaultChoice: "wrap",
      choices: [
        { id: "wrap", label: "Wrap", ops: [] },
        { id: "pita", label: "Pita", ops: [{ type: "replaceRole", role: "base", foodKey: "pita_bread" }] },
        { id: "plate", label: "Plate with rice", ops: [{ type: "replaceRole", role: "base", foodKey: "rice_white_cooked", gramsFactor: 2.4 }] },
      ],
    },
    sizeGroup(),
    sauceGroup("Sauce quantity (hummus/tahini)"),
    { id: "extras_protein", label: "Add-ons", kind: "multi", choices: [{ id: "extra_protein", label: "Extra falafel", ops: [{ type: "scaleRole", role: "protein", factor: 1.5 }] }] },
  ],
  referenceKey: "ref_falafel_pita",
  assumptions: ["Falafel modelled as Matvaretabellen's fried home-made falafel; deep-fried shop falafel can absorb more oil."],
  mainUncertainty: "Falafel count and frying oil",
  infer: (t): Selections => (has(t, /pita/) ? { bread: "pita" } : has(t, /plate|tallerken/) ? { bread: "plate" } : {}),
};

// ---------- sushi ----------

const nigiri: Archetype = {
  id: "sushi_nigiri",
  label: "Nigiri",
  match: [/nigiri/],
  // Per piece; multiplied by the piece count.
  base: [
    c("sushi_rice_cooked", "base", g(15, 20, 25)),
    c("salmon_raw", "protein", g(8, 11, 15)),
  ],
  options: [
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 30, defaultCount: 1, unit: "pcs", unknownLabel: "Number of pieces" },
    {
      id: "fish",
      label: "Fish",
      kind: "single",
      defaultChoice: "salmon",
      choices: [
        { id: "salmon", label: "Salmon", ops: [] },
        { id: "tuna", label: "Tuna", ops: [{ type: "replaceRole", role: "protein", foodKey: "tuna_raw" }] },
        { id: "prawn", label: "Prawn", ops: [{ type: "replaceRole", role: "protein", foodKey: "king_prawn_raw" }] },
        { id: "seared_salmon", label: "Flamed salmon + mayo", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(0.5, 1.5, 3)) }] },
      ],
    },
    {
      id: "rice",
      label: "Rice",
      kind: "single",
      defaultChoice: "normal",
      unknownLabel: "Rice per piece",
      narrows: ["base"],
      choices: [
        { id: "less", label: "Small rice ball", ops: [{ type: "scaleRole", role: "base", factor: 0.75 }] },
        { id: "normal", label: "Normal", ops: [] },
        { id: "more", label: "Large rice ball", ops: [{ type: "scaleRole", role: "base", factor: 1.25 }] },
      ],
    },
    {
      id: "dip",
      label: "Soy sauce",
      kind: "single",
      defaultChoice: "none",
      choices: [
        { id: "none", label: "Not counted", ops: [] },
        { id: "light", label: "A little", ops: [{ type: "add", component: c("soy_sauce", "sauce", g(0.5, 1, 2)) }] },
        { id: "regular", label: "Dipped", ops: [{ type: "add", component: c("soy_sauce", "sauce", g(1, 2, 3.5)) }] },
      ],
    },
  ],
  referenceKey: "ref_nigiri_salmon",
  assumptions: ["Per-piece weights assume ~20 g seasoned rice and ~11 g fish.", "Soy sauce adds mainly sodium; it is not counted unless you choose it."],
  mainUncertainty: "Rice per piece and fish slice size",
  infer: (t) => {
    const s: Selections = { pieces: piecesFromText(t, 8) };
    if (has(t, /tuna|tunfisk/)) s.fish = "tuna";
    else if (has(t, /prawn|shrimp|reke|scampi|ebi/)) s.fish = "prawn";
    else if (has(t, /flam|seared|aburi/)) s.fish = "seared_salmon";
    return s;
  },
};

const makiChoice = (id: string, label: string, ref: FoodKey): OptionChoice => ({
  id,
  label,
  ops: [{ type: "replaceRole", role: "base", foodKey: ref }],
});

const maki: Archetype = {
  id: "sushi_maki",
  label: "Maki / rolls",
  match: [/maki|uramaki|futomaki|roll\b|rolls\b|california|inside.?out/],
  base: [c("ref_maki_salmon", "base", g(20, 25, 32), "per piece, database average for this roll type")],
  options: [
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 30, defaultCount: 1, unit: "pcs", unknownLabel: "Number of pieces" },
    {
      id: "roll",
      label: "Roll type",
      kind: "single",
      defaultChoice: "salmon",
      choices: [
        makiChoice("salmon", "Salmon", "ref_maki_salmon"),
        makiChoice("california", "California", "ref_maki_california"),
        makiChoice("avocado", "Avocado (veg)", "ref_maki_avocado"),
      ],
    },
    {
      id: "toppings",
      label: "Toppings",
      kind: "multi",
      choices: [
        { id: "spicy_mayo", label: "Spicy mayo", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(1, 2.5, 4)) }] },
        { id: "teriyaki", label: "Teriyaki/eel sauce", ops: [{ type: "add", component: c("teriyaki_sauce", "sauce", g(1, 2.5, 4)) }] },
        { id: "soy", label: "Soy sauce dip", ops: [{ type: "add", component: c("soy_sauce", "sauce", g(1, 2, 3.5)) }] },
      ],
    },
  ],
  assumptions: [
    "Uses Matvaretabellen's analysed average for this roll type, scaled by an assumed 20–32 g per piece.",
    "Inside-out rolls with tempura, cream cheese or heavy sauce are higher than these averages.",
  ],
  mainUncertainty: "Piece weight and toppings",
  infer: (t) => {
    const s: Selections = { pieces: piecesFromText(t, 8) };
    if (has(t, /california|surimi|crab/)) s.roll = "california";
    else if (has(t, /avocado|veg/) && !has(t, /salmon|laks/)) s.roll = "avocado";
    const tops: string[] = [];
    if (has(t, /spicy|mayo/)) tops.push("spicy_mayo");
    if (has(t, /teriyaki|eel|unagi/)) tops.push("teriyaki");
    if (tops.length) s.toppings = tops;
    return s;
  },
};

const proteinChoices = (opts: { id: string; label: string; foodKey: FoodKey; factor?: number; extra?: Component[] }[]): OptionChoice[] =>
  opts.map((o) => ({ id: o.id, label: o.label, ops: [{ type: "replaceRole", role: "protein", foodKey: o.foodKey, gramsFactor: o.factor, extra: o.extra }] }));

const poke: Archetype = {
  id: "poke_bowl",
  label: "Poke bowl",
  match: [/pok[eé]/],
  base: [
    c("sushi_rice_cooked", "base", g(150, 200, 260)),
    c("salmon_raw", "protein", g(80, 110, 140)),
    c("avocado", "vegetable", g(25, 40, 60)),
    c("edamame", "vegetable", g(15, 30, 45)),
    c("cucumber", "vegetable", g(20, 35, 50)),
    c("carrot", "vegetable", g(10, 20, 35)),
    c("spring_onion", "vegetable", g(2, 5, 10)),
    c("sesame_seeds", "topping", g(1, 3, 6)),
    c("soy_sauce", "sauce", g(8, 15, 25)),
    c("oil_sesame", "sauce", g(1, 3, 6), "in the dressing"),
  ],
  options: [
    {
      id: "protein",
      label: "Protein",
      kind: "single",
      defaultChoice: "salmon",
      unknownLabel: undefined,
      choices: proteinChoices([
        { id: "salmon", label: "Salmon", foodKey: "salmon_raw" },
        { id: "tuna", label: "Tuna", foodKey: "tuna_raw" },
        { id: "chicken", label: "Chicken", foodKey: "chicken_fillet_cooked" },
        { id: "tofu", label: "Tofu", foodKey: "tofu" },
        { id: "prawn", label: "Prawns", foodKey: "king_prawn_raw" },
      ]),
    },
    {
      id: "base",
      label: "Base",
      kind: "single",
      defaultChoice: "rice",
      unknownLabel: "Rice portion",
      narrows: ["base"],
      choices: [
        { id: "rice", label: "Sushi rice", ops: [] },
        { id: "half", label: "Half rice, half salad", ops: [{ type: "scaleRole", role: "base", factor: 0.5 }, { type: "add", component: c("lettuce_iceberg", "vegetable", g(30, 50, 70)) }] },
        { id: "salad", label: "Salad only", ops: [{ type: "remove", role: "base" }, { type: "add", component: c("lettuce_iceberg", "vegetable", g(60, 90, 120)) }] },
        { id: "quinoa", label: "Quinoa", ops: [{ type: "replaceRole", role: "base", foodKey: "quinoa_cooked", gramsFactor: 0.9 }] },
      ],
    },
    {
      id: "mayo",
      label: "Spicy mayo",
      kind: "single",
      defaultChoice: "none",
      unknownLabel: "Mayo-based sauce",
      choices: [
        { id: "none", label: "None", ops: [] },
        { id: "drizzle", label: "Drizzle", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(6, 10, 15)) }] },
        { id: "regular", label: "Regular", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(12, 20, 30)) }] },
      ],
    },
    sizeGroup(0.8, 1.3),
    sauceGroup(),
    extraProteinGroup("Extra protein"),
  ],
  assumptions: ["Rice modelled as seasoned sushi rice (includes sugar and vinegar).", "Toppings vary a lot between shops; avocado and mayo are the big swing factors."],
  mainUncertainty: "Rice portion and mayo-based sauces",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /tuna|tunfisk/)) s.protein = "tuna";
    else if (has(t, /chicken|kylling/)) s.protein = "chicken";
    else if (has(t, /tofu|vegan/)) s.protein = "tofu";
    else if (has(t, /prawn|shrimp|reke/)) s.protein = "prawn";
    if (has(t, /spicy mayo|sriracha mayo|mayo/)) s.mayo = "drizzle";
    return s;
  },
};

// ---------- burgers & pizza ----------

const burger: Archetype = {
  id: "burger",
  label: "Burger",
  match: [/burger/],
  base: [
    c("burger_bun", "base", g(65, 80, 100)),
    c("beef_patty_raw", "protein", g(120, 150, 200), "raw weight of patty"),
    c("cheddar", "cheese", g(15, 20, 30)),
    c("mayonnaise", "sauce", g(8, 15, 25)),
    c("ketchup", "sauce", g(5, 12, 20)),
    c("lettuce_iceberg", "vegetable", g(10, 15, 25)),
    c("tomato_raw", "vegetable", g(15, 25, 35)),
    c("onion_raw", "vegetable", g(5, 10, 20)),
    c("pickled_cucumber", "vegetable", g(0, 10, 20)),
  ],
  options: [
    {
      id: "patty",
      label: "Patty",
      kind: "single",
      defaultChoice: "beef",
      choices: [
        { id: "beef", label: "Beef", ops: [] },
        { id: "double", label: "Double beef", ops: [{ type: "scaleRole", role: "protein", factor: 2 }, { type: "scaleRole", role: "cheese", factor: 2 }] },
        { id: "crispy_chicken", label: "Crispy chicken", ops: [{ type: "replaceRole", role: "protein", foodKey: "chicken_fillet_fried", gramsFactor: 0.8, extra: [c("pita_bread", "base", g(15, 25, 35), "breading, approximated as wheat bread")] }] },
        { id: "grilled_chicken", label: "Grilled chicken", ops: [{ type: "replaceRole", role: "protein", foodKey: "chicken_fillet_cooked", gramsFactor: 0.8 }] },
        { id: "veggie", label: "Falafel/veggie", ops: [{ type: "replaceRole", role: "protein", foodKey: "falafel", gramsFactor: 0.8 }] },
      ],
    },
    {
      id: "cheese",
      label: "Cheese",
      kind: "single",
      defaultChoice: "yes",
      choices: [
        { id: "yes", label: "Cheese", ops: [] },
        { id: "no", label: "No cheese", ops: [{ type: "remove", role: "cheese" }] },
      ],
    },
    sauceGroup("Burger sauce"),
    {
      id: "addons",
      label: "Add-ons",
      kind: "multi",
      choices: [
        { id: "bacon", label: "Bacon", ops: [{ type: "add", component: c("bacon_fried", "topping", g(15, 20, 30)) }] },
        { id: "fries", label: "Fries", ops: [{ type: "add", component: c("french_fries", "side", g(90, 130, 180)) }] },
        { id: "avocado", label: "Avocado", ops: [{ type: "add", component: c("avocado", "topping", g(25, 40, 60)) }] },
      ],
    },
  ],
  referenceKey: "ref_cheeseburger",
  assumptions: ["Patty values are for raw minced beef weight (cooking loses water, not calories).", "Burger sauce modelled as mayonnaise + ketchup."],
  mainUncertainty: "Patty weight and sauce",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /double|dobbel/)) s.patty = "double";
    else if (has(t, /crispy|fried chicken|sprø kylling/)) s.patty = "crispy_chicken";
    else if (has(t, /chicken|kylling/)) s.patty = "grilled_chicken";
    else if (has(t, /veg|falafel|plant/)) s.patty = "veggie";
    if (has(t, /no cheese|without cheese|uten ost/) || !has(t, /chees|\bost\b|cheddar/)) s.cheese = "no";
    const add: string[] = [];
    if (has(t, /bacon/)) add.push("bacon");
    if (has(t, /fries|pommes/)) add.push("fries");
    if (has(t, /avocado/)) add.push("avocado");
    if (add.length) s.addons = add;
    return s;
  },
};

const pizza: Archetype = {
  id: "pizza",
  label: "Pizza",
  match: [/pizza|margherita|margarita|pepperoni|calzone/],
  // Whole ~30 cm pizza
  base: [
    c("pizza_crust", "base", g(200, 250, 310)),
    c("tomato_canned", "sauce", g(50, 80, 110)),
    c("mozzarella", "cheese", g(80, 110, 150)),
    c("oil_olive", "fat", g(3, 8, 15)),
  ],
  options: [
    {
      id: "topping",
      label: "Topping",
      kind: "multi",
      choices: [
        { id: "pepperoni", label: "Pepperoni", ops: [{ type: "add", component: c("pepperoni", "topping", g(35, 50, 70)) }] },
        { id: "ham", label: "Ham", ops: [{ type: "add", component: c("ham_boiled", "topping", g(40, 60, 80)) }] },
        { id: "chicken", label: "Chicken", ops: [{ type: "add", component: c("chicken_fillet_cooked", "topping", g(50, 70, 100)) }] },
        { id: "mushroom", label: "Mushroom", ops: [{ type: "add", component: c("mushroom", "vegetable", g(30, 50, 70)) }] },
        { id: "veg", label: "Peppers & onion", ops: [{ type: "add", component: c("sweet_pepper", "vegetable", g(25, 40, 60)) }, { type: "add", component: c("onion_raw", "vegetable", g(15, 25, 40)) }] },
      ],
    },
    {
      id: "cheese",
      label: "Cheese",
      kind: "single",
      defaultChoice: "regular",
      unknownLabel: "Cheese amount",
      narrows: ["cheese"],
      choices: [
        { id: "light", label: "Light", ops: [{ type: "scaleRole", role: "cheese", factor: 0.6 }] },
        { id: "regular", label: "Regular", ops: [] },
        { id: "extra", label: "Extra", ops: [{ type: "scaleRole", role: "cheese", factor: 1.5 }] },
      ],
    },
    {
      id: "size",
      label: "Size",
      kind: "single",
      defaultChoice: "medium",
      unknownLabel: "Pizza size",
      narrows: "all",
      choices: [
        { id: "small", label: "Small (~24 cm)", ops: [{ type: "scaleAll", factor: 0.65 }] },
        { id: "medium", label: "Medium (~30 cm)", ops: [] },
        { id: "large", label: "Large (~36 cm)", ops: [{ type: "scaleAll", factor: 1.45 }] },
      ],
    },
    { id: "slices", label: "Slices eaten (of 8)", kind: "count", min: 1, max: 8, defaultCount: 8, unit: "slices" },
  ],
  referenceKey: "ref_pizza_margherita",
  assumptions: ["A medium pizza is assumed to be ~30 cm with a 250 g baked crust.", "Thin Neapolitan crusts are lighter; deep-pan crusts are heavier."],
  mainUncertainty: "Pizza size, crust thickness and cheese",
  infer: (t) => {
    const s: Selections = {};
    const tops: string[] = [];
    if (has(t, /pepperoni|salami/)) tops.push("pepperoni");
    if (has(t, /ham|skinke/)) tops.push("ham");
    if (has(t, /chicken|kylling/)) tops.push("chicken");
    if (has(t, /mushroom|sopp|champignon/)) tops.push("mushroom");
    if (has(t, /\b(peppers?|paprika|onions?|løk)\b/)) tops.push("veg");
    if (tops.length) s.topping = tops;
    if (has(t, /\b(small|liten|24 ?cm)\b/)) s.size = "small";
    if (has(t, /\b(large|stor|36 ?cm|family)\b/)) s.size = "large";
    return s;
  },
};

// ---------- drinks ----------

const boba: Archetype = {
  id: "boba",
  label: "Bubble tea",
  match: [/boba|bubble ?tea|milk ?tea|tapioca|brown sugar milk|taro|tea.*pearls?|pearls?.*tea/],
  // Medium ~500 ml cup with ice
  base: [
    c("tea_black", "drink", g(200, 260, 320)),
    c("milk_whole", "milk", g(60, 100, 150)),
    c("sugar_white", "sweetener", g(20, 30, 45), "sugar syrup, as dry sugar"),
    c("tapioca_pearl_dry", "pearls", g(20, 30, 40), "≈ 60–80 g cooked pearls"),
    c("sugar_brown", "pearls", g(3, 8, 15), "syrup the pearls are soaked in"),
  ],
  options: [
    {
      id: "size",
      label: "Cup size",
      kind: "single",
      defaultChoice: "medium",
      unknownLabel: "Cup size",
      narrows: "all",
      choices: [
        { id: "small", label: "Small (~350 ml)", ops: [{ type: "scaleAll", factor: 0.7 }] },
        { id: "medium", label: "Medium (~500 ml)", ops: [] },
        { id: "large", label: "Large (~700 ml)", ops: [{ type: "scaleAll", factor: 1.35 }] },
      ],
    },
    {
      id: "milk",
      label: "Milk",
      kind: "single",
      defaultChoice: "whole",
      unknownLabel: "Milk / creamer type",
      narrows: ["milk"],
      choices: [
        { id: "whole", label: "Whole milk", ops: [] },
        { id: "semi", label: "Low-fat milk", ops: [{ type: "replaceRole", role: "milk", foodKey: "milk_semi" }] },
        { id: "skimmed", label: "Skimmed", ops: [{ type: "replaceRole", role: "milk", foodKey: "milk_skimmed" }] },
        { id: "oat", label: "Oat drink", ops: [{ type: "replaceRole", role: "milk", foodKey: "oat_drink" }] },
        { id: "none", label: "No milk (fruit tea)", ops: [{ type: "remove", role: "milk" }, { type: "replaceRole", role: "drink", foodKey: "tea_green" }] },
      ],
    },
    {
      id: "sugar",
      label: "Sugar level",
      kind: "single",
      defaultChoice: "100",
      unknownLabel: "Sugar level",
      narrows: ["sweetener"],
      choices: [
        { id: "0", label: "0%", ops: [{ type: "remove", role: "sweetener" }] },
        { id: "25", label: "25%", ops: [{ type: "scaleRole", role: "sweetener", factor: 0.25 }] },
        { id: "50", label: "50%", ops: [{ type: "scaleRole", role: "sweetener", factor: 0.5 }] },
        { id: "75", label: "75%", ops: [{ type: "scaleRole", role: "sweetener", factor: 0.75 }] },
        { id: "100", label: "100%", ops: [] },
      ],
    },
    {
      id: "pearls",
      label: "Tapioca pearls",
      kind: "single",
      defaultChoice: "regular",
      narrows: ["pearls"],
      choices: [
        { id: "none", label: "None", ops: [{ type: "remove", role: "pearls" }] },
        { id: "regular", label: "Regular", ops: [] },
        { id: "extra", label: "Extra", ops: [{ type: "scaleRole", role: "pearls", factor: 1.6 }] },
      ],
    },
    {
      id: "toppings",
      label: "Toppings",
      kind: "multi",
      choices: [
        { id: "cheese_foam", label: "Cheese foam", ops: [{ type: "add", component: c("cream_cheese", "topping", g(10, 20, 30)) }, { type: "add", component: c("sugar_white", "topping", g(2, 5, 8)) }] },
        { id: "brown_sugar", label: "Brown sugar syrup", ops: [{ type: "add", component: c("sugar_brown", "topping", g(10, 15, 25)) }] },
      ],
    },
  ],
  assumptions: [
    "Many shops use non-dairy creamer powder instead of milk; it is not in our food database and is modelled as whole milk, which can understate fat.",
    "100% sugar assumes ~30 g sugar syrup (dry-sugar equivalent) in a medium cup.",
    "Tapioca pearls are modelled by dry weight (USDA FoodData Central).",
  ],
  mainUncertainty: "Sugar syrup and creamer",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /oat|havre/)) s.milk = "oat";
    if (has(t, /fruit|passion|mango|lychee|peach|green tea/) && !has(t, /milk/)) s.milk = "none";
    if (has(t, /cheese foam|cream cheese/)) s.toppings = ["cheese_foam"];
    if (has(t, /brown sugar/)) s.toppings = [...((s.toppings as string[]) ?? []), "brown_sugar"];
    if (has(t, /\b(large|l)\b/)) s.size = "large";
    return s;
  },
};

const latte: Archetype = {
  id: "latte",
  label: "Latte / cappuccino",
  match: [/latte|cappuccino|flat white|cortado|mocha/],
  base: [c("coffee", "drink", g(25, 35, 60), "espresso"), c("milk_whole", "milk", g(150, 220, 300))],
  options: [
    {
      id: "milk",
      label: "Milk",
      kind: "single",
      defaultChoice: "whole",
      unknownLabel: "Milk type",
      choices: [
        { id: "whole", label: "Whole", ops: [] },
        { id: "semi", label: "Low-fat", ops: [{ type: "replaceRole", role: "milk", foodKey: "milk_semi" }] },
        { id: "skimmed", label: "Skimmed", ops: [{ type: "replaceRole", role: "milk", foodKey: "milk_skimmed" }] },
        { id: "oat", label: "Oat", ops: [{ type: "replaceRole", role: "milk", foodKey: "oat_drink" }] },
      ],
    },
    sizeGroup(0.6, 1.4, "Cup size"),
    {
      id: "syrup",
      label: "Syrup",
      kind: "single",
      defaultChoice: "none",
      choices: [
        { id: "none", label: "None", ops: [] },
        { id: "one", label: "1 pump", ops: [{ type: "add", component: c("sugar_white", "sweetener", g(5, 7, 10)) }] },
        { id: "two", label: "2 pumps", ops: [{ type: "add", component: c("sugar_white", "sweetener", g(10, 14, 20)) }] },
      ],
    },
  ],
  referenceKey: "ref_caffe_latte_whole",
  assumptions: ["A regular latte assumes ~220 g milk; cappuccinos use less milk, flat whites less still."],
  mainUncertainty: "Cup size",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /oat|havre/)) s.milk = "oat";
    if (has(t, /cappuccino|flat white|cortado/)) s.size = "small";
    if (has(t, /mocha|caramel|vanilla|syrup/)) s.syrup = "one";
    return s;
  },
};

// ---------- bowls, salads, noodles ----------

const caesar: Archetype = {
  id: "salad",
  label: "Chicken salad",
  match: [/caesar|salad|salat/],
  base: [
    c("lettuce_iceberg", "vegetable", g(70, 110, 160)),
    c("tomato_raw", "vegetable", g(20, 40, 60)),
    c("chicken_fillet_cooked", "protein", g(80, 110, 150)),
    c("parmesan", "cheese", g(5, 12, 20)),
    c("pita_bread", "base", g(10, 20, 35), "croutons, approximated as wheat bread"),
    c("caesar_dressing", "sauce", g(25, 45, 70)),
  ],
  options: [
    {
      id: "protein",
      label: "Protein",
      kind: "single",
      defaultChoice: "chicken",
      choices: proteinChoices([
        { id: "chicken", label: "Chicken", foodKey: "chicken_fillet_cooked" },
        { id: "salmon", label: "Salmon", foodKey: "salmon_roasted" },
        { id: "prawn", label: "Prawns", foodKey: "king_prawn_raw" },
        { id: "tofu", label: "Tofu", foodKey: "tofu" },
        { id: "feta", label: "Feta (veg)", foodKey: "feta", factor: 0.5 },
      ]),
    },
    {
      id: "dressing",
      label: "Dressing",
      kind: "single",
      defaultChoice: "caesar",
      unknownLabel: "Dressing amount",
      narrows: ["sauce"],
      choices: [
        { id: "caesar", label: "Caesar", ops: [] },
        { id: "side", label: "On the side, half used", ops: [{ type: "scaleRole", role: "sauce", factor: 0.5 }] },
        { id: "vinaigrette", label: "Oil & vinegar", ops: [{ type: "replaceRole", role: "sauce", foodKey: "oil_olive", gramsFactor: 0.35 }] },
        { id: "none", label: "No dressing", ops: [{ type: "remove", role: "sauce" }] },
      ],
    },
    { id: "addons", label: "Add-ons", kind: "multi", choices: [
      { id: "bacon", label: "Bacon", ops: [{ type: "add", component: c("bacon_fried", "topping", g(10, 20, 30)) }] },
      { id: "avocado", label: "Avocado", ops: [{ type: "add", component: c("avocado", "topping", g(30, 50, 70)) }] },
      { id: "egg", label: "Egg", ops: [{ type: "add", component: c("egg_boiled", "topping", g(40, 50, 60)) }] },
      { id: "no_croutons", label: "No croutons", ops: [{ type: "remove", role: "base" }] },
    ] },
    sizeGroup(),
  ],
  referenceKey: "ref_chicken_feta_salad",
  assumptions: ["Dressing is the largest source of uncertainty in salads — Caesar dressing is ~50% fat."],
  mainUncertainty: "Dressing quantity",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /salmon|laks/)) s.protein = "salmon";
    else if (has(t, /prawn|shrimp|reke/)) s.protein = "prawn";
    else if (has(t, /tofu|vegan/)) s.protein = "tofu";
    else if (has(t, /feta|greek|gresk/) && !has(t, /chicken|kylling/)) s.protein = "feta";
    if (!has(t, /caesar/)) s.dressing = "vinaigrette";
    const add: string[] = [];
    if (has(t, /bacon/)) add.push("bacon");
    if (has(t, /avocado/)) add.push("avocado");
    if (has(t, /\begg|\begg\b/)) add.push("egg");
    if (add.length) s.addons = add;
    return s;
  },
};

const noodles: Archetype = {
  id: "noodles",
  label: "Wok / noodles",
  match: [/pad ?thai|noodle|nudler|wok|lo mein|chow mein|yakisoba|udon|ramen/],
  base: [
    c("rice_noodles_cooked", "base", g(180, 250, 320)),
    c("chicken_fillet_cooked", "protein", g(70, 100, 140)),
    c("egg_boiled", "protein", g(0, 30, 55), "scrambled egg"),
    c("sweet_pepper", "vegetable", g(20, 40, 60)),
    c("carrot", "vegetable", g(15, 30, 45)),
    c("spring_onion", "vegetable", g(5, 10, 20)),
    c("oil_rapeseed", "fat", g(8, 15, 28), "wok oil"),
    c("soy_sauce", "sauce", g(10, 20, 30)),
    c("sugar_white", "sauce", g(5, 12, 20), "sugar/palm sugar in sauce"),
  ],
  options: [
    {
      id: "protein",
      label: "Protein",
      kind: "single",
      defaultChoice: "chicken",
      choices: [
        { id: "chicken", label: "Chicken", ops: [] },
        { id: "prawn", label: "Prawns", ops: [{ type: "replaceRole", role: "protein", foodKey: "king_prawn_raw", extra: [c("egg_boiled", "protein", g(0, 30, 55))] }] },
        { id: "beef", label: "Beef", ops: [{ type: "replaceRole", role: "protein", foodKey: "beef_striploin_roasted", extra: [c("egg_boiled", "protein", g(0, 30, 55))] }] },
        { id: "tofu", label: "Tofu", ops: [{ type: "replaceRole", role: "protein", foodKey: "tofu", extra: [c("egg_boiled", "protein", g(0, 30, 55))] }] },
      ],
    },
    {
      id: "noodle",
      label: "Noodles",
      kind: "single",
      defaultChoice: "rice",
      choices: [
        { id: "rice", label: "Rice noodles", ops: [] },
        { id: "wheat", label: "Egg/wheat noodles", ops: [{ type: "replaceRole", role: "base", foodKey: "noodles_wheat_cooked" }] },
        { id: "rice_side", label: "Fried rice", ops: [{ type: "replaceRole", role: "base", foodKey: "rice_white_cooked" }] },
      ],
    },
    oilGroup,
    sizeGroup(),
    extraProteinGroup("Extra protein"),
  ],
  referenceKey: "ref_pad_thai",
  assumptions: ["Wok oil is the largest unknown — restaurant woks commonly use 1–2 tablespoons per portion."],
  mainUncertainty: "Cooking oil and noodle portion",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /prawn|shrimp|reke|scampi/)) s.protein = "prawn";
    else if (has(t, /beef|biff|okse/)) s.protein = "beef";
    else if (has(t, /tofu|vegan|veg\b/)) s.protein = "tofu";
    if (has(t, /egg noodle|wheat|udon|lo mein|chow mein|yakisoba|ramen/)) s.noodle = "wheat";
    if (has(t, /fried rice|stekt ris/)) s.noodle = "rice_side";
    return s;
  },
};

const riceBowl: Archetype = {
  id: "rice_bowl",
  label: "Rice bowl",
  match: [/teriyaki|rice bowl|donburi|bibimbap|katsu|bowl/],
  base: [
    c("rice_white_cooked", "base", g(170, 230, 300)),
    c("chicken_thigh_roasted", "protein", g(110, 150, 190)),
    c("teriyaki_sauce", "sauce", g(20, 40, 60)),
    c("broccoli_cooked", "vegetable", g(30, 60, 90)),
    c("carrot", "vegetable", g(10, 20, 35)),
    c("sesame_seeds", "topping", g(1, 3, 5)),
    c("oil_rapeseed", "fat", g(3, 8, 15)),
  ],
  options: [
    {
      id: "protein",
      label: "Protein",
      kind: "single",
      defaultChoice: "chicken",
      choices: proteinChoices([
        { id: "chicken", label: "Chicken thigh", foodKey: "chicken_thigh_roasted" },
        { id: "breast", label: "Chicken breast", foodKey: "chicken_fillet_cooked" },
        { id: "salmon", label: "Salmon", foodKey: "salmon_roasted", factor: 0.85 },
        { id: "beef", label: "Beef", foodKey: "beef_striploin_roasted" },
        { id: "tofu", label: "Tofu", foodKey: "tofu" },
      ]),
    },
    {
      id: "base",
      label: "Base",
      kind: "single",
      defaultChoice: "rice",
      unknownLabel: "Rice portion",
      narrows: ["base"],
      choices: [
        { id: "rice", label: "White rice", ops: [] },
        { id: "half", label: "Half rice", ops: [{ type: "scaleRole", role: "base", factor: 0.5 }, { type: "scaleRole", role: "vegetable", factor: 1.6 }] },
        { id: "quinoa", label: "Quinoa", ops: [{ type: "replaceRole", role: "base", foodKey: "quinoa_cooked" }] },
      ],
    },
    sauceGroup(),
    oilGroup,
    sizeGroup(),
  ],
  assumptions: ["Teriyaki-style sauce is mostly sugar and soy; the database's teriyaki sauce is used."],
  mainUncertainty: "Rice portion and sauce",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /salmon|laks/)) s.protein = "salmon";
    else if (has(t, /beef|biff|bulgogi/)) s.protein = "beef";
    else if (has(t, /tofu|vegan/)) s.protein = "tofu";
    else if (has(t, /breast|bryst|fillet|filet/)) s.protein = "breast";
    return s;
  },
};

/** Ordered from most to least specific: first match wins. */
export const ARCHETYPES: Archetype[] = [
  kebabPlate,
  kebabPita,
  kebabWrap,
  falafelWrap,
  nigiri,
  poke,
  maki,
  boba,
  latte,
  pizza,
  burger,
  noodles,
  caesar,
  riceBowl,
];

export const ARCHETYPE_IDS = ARCHETYPES.map((a) => a.id);

export function getArchetype(id: string | null | undefined): Archetype | undefined {
  return ARCHETYPES.find((a) => a.id === id);
}

/** Matches on the dish name first, so "Veggie burger (falafel patty)" is a burger, not a falafel wrap. */
export function detectArchetype(name: string, description = ""): Archetype | undefined {
  const find = (t: string) => ARCHETYPES.find((a) => a.match.some((re) => re.test(t)));
  return find(name.toLowerCase()) ?? find(`${name} ${description}`.toLowerCase());
}

/** Generic refinement questions for free-form (non-archetype) recipes, based on roles present. */
export function genericOptions(components: Component[]): OptionGroup[] {
  const roles = new Set(components.map((x) => x.role));
  const out: OptionGroup[] = [sizeGroup()];
  if (roles.has("sauce")) out.push(sauceGroup());
  if (roles.has("fat")) out.push(oilGroup);
  if (roles.has("protein")) out.push(extraProteinGroup("Extra protein"));
  return out;
}
