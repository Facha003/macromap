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
  match: [/maki|uramaki|futomaki|roll\b|rolls\b|\brull\b|rulle|ruller|california|inside.?out|dragon|crunchy roll/],
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
        makiChoice("tempura", "Tempura / fried", "ref_maki_tempura"),
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
    if (has(t, /tempura|fritert|crispy|crunchy/)) s.roll = "tempura";
    else if (has(t, /california|surimi|crab/)) s.roll = "california";
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
  match: [/caesar|cæsar|cesar|salad|salat/],
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
  match: [/pad ?thai|fried rice|stekt ris|nasi goreng|chow fan|noodle|nudler|wok|lo mein|chow mein|yakisoba|udon|ramen/],
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

// ═════════════════════ More dish types (common on Norwegian menus) ═════════════════════

type ProteinId = "chicken" | "beef" | "lamb" | "pork" | "salmon" | "cod" | "halibut" | "prawn" | "scallop" | "duck" | "tofu" | "paneer" | "legume";

/** Keyword → protein, checked in order (Norwegian, English, Italian). */
const PROTEIN_WORDS: [RegExp, ProteinId][] = [
  [/kylling|chicken|høne|pollo|poulet|tikka|tandoori/, "chicken"],
  [/kamskjell|scallop|capesante|blåskjell|mussel|cozze/, "scallop"],
  [/scampi|reke|shrimp|prawn|gamber|kreps|crab|krabbe|frutti di mare|skalldyr|sjømat|seafood|hummer|lobster/, "prawn"],
  [/kveite|halibut/, "halibut"],
  [/laks|salmon|salmone/, "salmon"],
  [/torsk|cod\b|skrei|bacalao|baccal|\bsei\b|hyse|steinbit|breiflabb|fisk|fish|pesce/, "cod"],
  [/\band\b|andebryst|duck|anatra|magret/, "duck"],
  [/\blam\b|lamb|lamme|agnello|lammeskank/, "lamb"],
  [/svin|pork|ribbe|maiale|cochinita|carnitas|al pastor|pulled pork|bacon|skinke|\bham\b|pancetta|guanciale/, "pork"],
  [/biff|beef|okse|manzo|entrec|indrefilet|ytrefilet|mørbrad|rib.?eye|short rib|flank|steak|bulgogi|hamburgerrygg|kjøttdeig|kjøttboller|meatball|bolognese|chili con carne|reinsdyr|hjort|elg|vilt/, "beef"],
  [/tofu/, "tofu"],
  [/paneer/, "paneer"],
  [/kikert|chickpea|chana|\bdal\b|daal|dhal|linse|lentil|bønne|bean/, "legume"],
];

function proteinOf(text: string): ProteinId | undefined {
  return PROTEIN_WORDS.find(([re]) => re.test(text))?.[1];
}

const PROTEIN_FOOD: Record<ProteinId, { foodKey: FoodKey; label: string }> = {
  chicken: { foodKey: "chicken_thigh_roasted", label: "Chicken" },
  beef: { foodKey: "beef_striploin_roasted", label: "Beef" },
  lamb: { foodKey: "lamb_roasted", label: "Lamb" },
  pork: { foodKey: "pork_tenderloin_roasted", label: "Pork" },
  salmon: { foodKey: "salmon_roasted", label: "Salmon" },
  cod: { foodKey: "cod_roasted", label: "White fish" },
  halibut: { foodKey: "halibut_simmered", label: "Halibut" },
  prawn: { foodKey: "king_prawn_raw", label: "Prawns" },
  scallop: { foodKey: "scallop_fried", label: "Scallops / shellfish" },
  duck: { foodKey: "duck_roasted", label: "Duck" },
  tofu: { foodKey: "tofu", label: "Tofu" },
  paneer: { foodKey: "paneer", label: "Paneer" },
  legume: { foodKey: "chickpeas_boiled", label: "Lentils / chickpeas" },
};

function proteinGroup(ids: ProteinId[], def: ProteinId): OptionGroup {
  return {
    id: "protein",
    label: "Protein",
    kind: "single",
    defaultChoice: def,
    choices: proteinChoices(ids.map((id) => ({ id, label: PROTEIN_FOOD[id].label, foodKey: PROTEIN_FOOD[id].foodKey }))),
  };
}

function inferProtein(text: string, allowed: ProteinId[], into: Selections) {
  const p = proteinOf(text);
  if (p && allowed.includes(p)) into.protein = p;
}

const sideGroup = (def: "potatoes" | "rice" | "fries" | "mash" | "salad" | "none" = "potatoes"): OptionGroup => ({
  id: "side",
  label: "Side",
  kind: "single",
  defaultChoice: def,
  unknownLabel: "Side dish",
  choices: [
    { id: "potatoes", label: "Potatoes", ops: [{ type: "replaceRole", role: "base", foodKey: "potatoes_boiled" }] },
    { id: "fries", label: "Fries", ops: [{ type: "replaceRole", role: "base", foodKey: "french_fries", gramsFactor: 0.75 }] },
    { id: "mash", label: "Mash", ops: [{ type: "replaceRole", role: "base", foodKey: "potatoes_mashed" }] },
    { id: "rice", label: "Rice", ops: [{ type: "replaceRole", role: "base", foodKey: "rice_white_cooked" }] },
    { id: "salad", label: "Salad", ops: [{ type: "replaceRole", role: "base", foodKey: "lettuce_iceberg", gramsFactor: 0.4 }] },
    { id: "none", label: "No side", ops: [{ type: "remove", role: "base" }] },
  ],
});

const inferSide = (t: string, s: Selections) => {
  if (has(t, /pommes|frites|fries|chips\b/)) s.side = "fries";
  else if (has(t, /potetmos|\bmos\b|puré|mash/)) s.side = "mash";
  else if (has(t, /\bris\b|rice|risotto|basmati/)) s.side = "rice";
  else if (has(t, /potet|potato|patate/)) s.side = "potatoes";
};

const plateSauce: OptionGroup = {
  id: "sauce",
  label: "Sauce",
  kind: "single",
  defaultChoice: "regular",
  unknownLabel: "Sauce",
  narrows: ["sauce"],
  choices: [
    { id: "regular", label: "Typical", ops: [] },
    { id: "rich", label: "Béarnaise / butter", ops: [{ type: "replaceRole", role: "sauce", foodKey: "hollandaise", gramsFactor: 1.1 }] },
    { id: "cream", label: "Cream / pepper", ops: [{ type: "replaceRole", role: "sauce", foodKey: "cream_18", gramsFactor: 1.3 }] },
    { id: "light", label: "Light / jus", ops: [{ type: "scaleRole", role: "sauce", factor: 0.4 }] },
    { id: "none", label: "None", ops: [{ type: "remove", role: "sauce" }] },
  ],
};

const inferPlateSauce = (t: string, s: Selections) => {
  if (has(t, /b[ée]arnaise|hollandaise|smørsaus|beurre blanc|butter sauce|hvitvinssaus/)) s.sauce = "rich";
  else if (has(t, /pepper|fløte|cream|kremet|creamy|soppsaus|mushroom sauce/)) s.sauce = "cream";
  else if (has(t, /\bjus\b|rødvin|red wine|demi|kraft/)) s.sauce = "light";
};

/** Main course: protein + side + vegetables + sauce. Used for meat, fish and unrecognised plates. */
function plate(opts: { id: string; label: string; match: RegExp[]; protein: ProteinId; proteins: ProteinId[]; grams: Range; assumptions: string[]; referenceKey?: FoodKey }): Archetype {
  return {
    id: opts.id,
    label: opts.label,
    match: opts.match,
    base: [
      c(PROTEIN_FOOD[opts.protein].foodKey, "protein", opts.grams),
      c("potatoes_boiled", "base", g(130, 190, 260)),
      c("broccoli_cooked", "vegetable", g(30, 50, 80)),
      c("carrot", "vegetable", g(20, 35, 60)),
      c("cream_18", "sauce", g(20, 40, 70), "sauce, modelled as cream"),
      c("butter", "fat", g(0, 6, 15), "cooking fat"),
    ],
    options: [proteinGroup(opts.proteins, opts.protein), sideGroup(), plateSauce, sizeGroup(0.7, 1.3)],
    referenceKey: opts.referenceKey,
    assumptions: opts.assumptions,
    mainUncertainty: "Portion size, sauce and cooking fat",
    infer: (t) => {
      const s: Selections = {};
      inferProtein(t, opts.proteins, s);
      inferSide(t, s);
      inferPlateSauce(t, s);
      return s;
    },
  };
}

const ALL_MEATS: ProteinId[] = ["beef", "lamb", "pork", "duck", "chicken"];
const ALL_FISH: ProteinId[] = ["salmon", "cod", "halibut", "prawn", "scallop"];

const meatMain = plate({
  id: "meat_main",
  label: "Meat main course",
  match: [/biff|indrefilet|ytrefilet|entrec|mørbrad|rib.?eye|short ribs?|flank|t-bone|steak|lammeskank|lammecarr|lammekotel|lammestek|svinefilet|svinekotel|ribbe|pinnekjøtt|andebryst|confit|reinsdyr|hjort|elg\b|viltgryte|stroganoff|kjøttkaker|kjøttboller|meatballs|schnitzel|wienerschnitzel|karbonade|fårikål|lapskaus|gryte|stew/],
  protein: "beef",
  proteins: ALL_MEATS,
  grams: g(150, 200, 280),
  assumptions: ["Meat weight is cooked weight; restaurant mains commonly serve 180–250 g.", "Sauce modelled as cream unless you choose otherwise."],
});

const fishMain = plate({
  id: "fish_main",
  label: "Fish / seafood main course",
  match: [/laks|salmon|torsk|\bcod\b|skrei|kveite|halibut|bacalao|\bsei\b|hyse|steinbit|breiflabb|ørret|trout|fiskegrateng|fiskekaker|fish|fisk|sjømat|seafood|kamskjell|scallop|blåskjell|mussel|scampi|reker|shrimp|prawn/],
  protein: "salmon",
  proteins: ALL_FISH,
  grams: g(120, 170, 230),
  assumptions: ["Fish weight is cooked fillet weight.", "Sauce modelled as cream unless you choose otherwise."],
});

const genericPlate = plate({
  id: "plate",
  label: "Main course",
  match: [/kylling|chicken|biff|beef|okse|svin|pork|\blam\b|lamb|\band\b|duck|tofu|paneer|dagens|middag|tallerken|hovedrett|main course/],
  protein: "chicken",
  proteins: ["chicken", "beef", "pork", "lamb", "salmon", "cod", "prawn", "tofu", "paneer", "legume"],
  grams: g(120, 160, 220),
  assumptions: ["Dish type not recognised in detail — estimated as a typical main course plate (protein, side, vegetables, sauce)."],
});

const meatStarter: Archetype = {
  id: "meat_starter",
  label: "Carpaccio / tartar",
  match: [/carpaccio|tartar|tartare|tataki|crudo|ceviche/],
  base: [c("beef_striploin_roasted", "protein", g(50, 80, 120), "raw weight"), c("parmesan", "cheese", g(0, 10, 20)), c("oil_olive", "fat", g(4, 10, 18)), c("lettuce_iceberg", "vegetable", g(10, 25, 40))],
  options: [
    { id: "protein", label: "Protein", kind: "single", defaultChoice: "beef", choices: proteinChoices([{ id: "beef", label: "Beef", foodKey: "beef_striploin_roasted" }, { id: "salmon", label: "Salmon", foodKey: "salmon_raw" }, { id: "tuna", label: "Tuna", foodKey: "tuna_raw" }, { id: "fish", label: "White fish", foodKey: "cod_roasted" }]) },
    { id: "addons", label: "Add-ons", kind: "multi", choices: [{ id: "bread", label: "Bread / toast", ops: [{ type: "add", component: c("bread_roll", "side", g(20, 35, 50)) }] }, { id: "yolk", label: "Egg yolk / mayo", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(5, 10, 20)) }] }] },
    sizeGroup(0.75, 1.6, "Starter or main size"),
  ],
  assumptions: ["Starter-size portion of raw or cured fish/meat."],
  mainUncertainty: "Portion size and oil",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /laks|salmon/)) s.protein = "salmon";
    else if (has(t, /tun|tuna|yellowtail|hamachi/)) s.protein = "tuna";
    else if (has(t, /ceviche|torsk|kveite|fisk|fish/)) s.protein = "fish";
    return s;
  },
};

const curry: Archetype = {
  id: "curry",
  label: "Curry",
  match: [/curry|karri|masala|korma|vindaloo|madras|jalfrezi|butter chicken|saag|palak|rogan|\bdal\b|daal|dhal|biryani|panang|massaman|bhuna|balti|kadai|karahi|makhani|dopiaza|pasanda/],
  base: [
    c("basmati_cooked", "base", g(150, 220, 300)),
    c("chicken_thigh_roasted", "protein", g(100, 150, 200)),
    c("cream_18", "sauce", g(30, 60, 100)),
    c("tomato_canned", "sauce", g(40, 80, 120)),
    c("onion_raw", "vegetable", g(20, 40, 60)),
    c("oil_rapeseed", "fat", g(8, 15, 28), "cooking oil / ghee"),
  ],
  options: [
    proteinGroup(["chicken", "lamb", "beef", "prawn", "cod", "paneer", "legume", "tofu"], "chicken"),
    {
      id: "style",
      label: "Sauce style",
      kind: "single",
      defaultChoice: "creamy",
      choices: [
        { id: "creamy", label: "Creamy (tikka masala, korma)", ops: [] },
        { id: "coconut", label: "Coconut (Thai, Kerala)", ops: [{ type: "replaceRole", role: "sauce", foodKey: "coconut_milk", gramsFactor: 1.6 }] },
        { id: "tomato", label: "Tomato (madras, vindaloo)", ops: [{ type: "replaceRole", role: "sauce", foodKey: "tomato_canned", gramsFactor: 1.8 }] },
        { id: "spinach", label: "Spinach (saag, palak)", ops: [{ type: "replaceRole", role: "sauce", foodKey: "spinach", gramsFactor: 1.5, extra: [c("cream_18", "sauce", g(10, 25, 40))] }] },
      ],
    },
    {
      id: "side",
      label: "Served with",
      kind: "single",
      defaultChoice: "rice",
      unknownLabel: "Rice / naan",
      choices: [
        { id: "rice", label: "Rice", ops: [] },
        { id: "naan", label: "Naan", ops: [{ type: "replaceRole", role: "base", foodKey: "flatbread_soft", gramsFactor: 0.45 }] },
        { id: "both", label: "Rice + naan", ops: [{ type: "add", component: c("flatbread_soft", "side", g(70, 90, 120)) }] },
        { id: "none", label: "Nothing", ops: [{ type: "remove", role: "base" }] },
      ],
    },
    oilGroup,
    sizeGroup(),
  ],
  referenceKey: "ref_butter_chicken",
  assumptions: ["Restaurant curries often use generous oil, ghee and cream — the biggest unknowns."],
  mainUncertainty: "Cooking fat and cream",
  infer: (t) => {
    const s: Selections = {};
    inferProtein(t, ["chicken", "lamb", "beef", "prawn", "cod", "paneer", "legume", "tofu"], s);
    if (has(t, /kokos|coconut|thai|panang|massaman|green curry|red curry|grønn karri|rød karri|kerala|malabar/)) s.style = "coconut";
    else if (has(t, /madras|vindaloo|jalfrezi|rogan|bhuna|balti|kadai|karahi|\bdal\b|daal|dhal/)) s.style = "tomato";
    else if (has(t, /saag|palak|spinat|spinach/)) s.style = "spinach";
    if (has(t, /biryani/)) s.side = "rice";
    return s;
  },
};

const tandoori: Archetype = {
  id: "tandoori",
  label: "Tandoori / grill",
  match: [/tandoori|tikka|seekh|shashlik|souvlaki|grillspyd|skewer|spyd|yakitori|satay|sate\b/],
  base: [
    c("chicken_thigh_roasted", "protein", g(150, 200, 260)),
    c("greek_yogurt_10", "sauce", g(10, 25, 45), "marinade / raita"),
    c("oil_rapeseed", "fat", g(3, 8, 15)),
    c("onion_raw", "vegetable", g(20, 40, 60)),
    c("sweet_pepper", "vegetable", g(20, 40, 60)),
  ],
  options: [
    proteinGroup(["chicken", "lamb", "beef", "prawn", "cod", "paneer"], "chicken"),
    {
      id: "side",
      label: "Served with",
      kind: "single",
      defaultChoice: "none",
      unknownLabel: "Rice / naan",
      choices: [
        { id: "none", label: "As listed", ops: [] },
        { id: "rice", label: "Rice", ops: [{ type: "add", component: c("basmati_cooked", "base", g(150, 200, 280)) }] },
        { id: "naan", label: "Naan", ops: [{ type: "add", component: c("flatbread_soft", "base", g(70, 90, 120)) }] },
      ],
    },
    sizeGroup(0.6, 1.3, "Starter or main size"),
  ],
  assumptions: ["Grilled with a yoghurt marinade; sides not included unless you add them."],
  mainUncertainty: "Portion size",
  infer: (t) => {
    const s: Selections = {};
    inferProtein(t, ["chicken", "lamb", "beef", "prawn", "cod", "paneer"], s);
    if (has(t, /\bris\b|rice/)) s.side = "rice";
    if (has(t, /naan|\bnan\b/)) s.side = "naan";
    return s;
  },
};

const naan: Archetype = {
  id: "naan",
  label: "Naan / bread",
  match: [/\bnaan\b|\bnan\b|roti|chapati|paratha|focaccia|garlic bread|hvitløksbrød|bruschetta|brødkurv|bread basket/],
  base: [c("flatbread_soft", "base", g(60, 85, 120)), c("butter", "fat", g(3, 8, 15))],
  options: [
    { id: "extra", label: "Type", kind: "multi", choices: [{ id: "cheese", label: "Cheese", ops: [{ type: "add", component: c("mozzarella", "cheese", g(15, 30, 45)) }] }, { id: "garlic", label: "Garlic butter", ops: [{ type: "scaleRole", role: "fat", factor: 1.6 }] }] },
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 6, defaultCount: 1, unit: "pcs" },
  ],
  assumptions: ["One naan/flatbread of about 85 g, brushed with butter."],
  mainUncertainty: "Bread size and butter",
  infer: (t) => {
    const s: Selections = {};
    const extra: string[] = [];
    if (has(t, /cheese|ost/)) extra.push("cheese");
    if (has(t, /garlic|hvitløk/)) extra.push("garlic");
    if (extra.length) s.extra = extra;
    return s;
  },
};

const friedSnack: Archetype = {
  id: "fried_snack",
  label: "Fried starter",
  match: [/samosa|pakora|bhaji|vårrull|varrull|spring ?roll|loempia|tempura|onion rings|løkringer|calamar|blekksprut|kroketter|krokett|croquette|arancini|mozzarella sticks|fritert|frityr|deep.?fried|popcorn/],
  // Per piece; multiplied by the count.
  base: [c("pita_bread", "base", g(10, 14, 20), "batter / pastry"), c("oil_rapeseed", "fat", g(2, 4, 7), "frying oil absorbed"), c("potatoes_boiled", "vegetable", g(8, 14, 20), "filling")],
  options: [
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 20, defaultCount: 1, unit: "pcs", unknownLabel: "Number of pieces" },
    proteinGroup(["chicken", "prawn", "cod", "paneer", "legume"], "legume"),
    { id: "dip", label: "Dip", kind: "single", defaultChoice: "none", choices: [{ id: "none", label: "None", ops: [] }, { id: "sweet", label: "Sweet chili", ops: [{ type: "add", component: c("sweet_chili_sauce", "sauce", g(3, 6, 10)) }] }, { id: "mayo", label: "Mayo / aioli", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(3, 6, 10)) }] }] },
  ],
  assumptions: ["Per piece ≈ 30 g: batter/pastry, filling and absorbed frying oil. Frying oil is the main unknown."],
  mainUncertainty: "Number of pieces and frying oil",
  infer: (t) => {
    const s: Selections = {};
    const p = proteinOf(t);
    if (p && ["chicken", "prawn", "cod", "paneer"].includes(p)) s.protein = p;
    else if (has(t, /calamar|blekksprut|squid/)) s.protein = "cod";
    s.pieces = piecesFromText(t, has(t, /vårrull|spring ?roll|samosa/) ? 2 : has(t, /onion rings|løkringer|pakora|tempura|calamar|popcorn/) ? 8 : 4);
    if (has(t, /chili|chilli/)) s.dip = "sweet";
    else if (has(t, /aioli|mayo|majones/)) s.dip = "mayo";
    return s;
  },
};

const dumplings: Archetype = {
  id: "dumplings",
  label: "Dumplings / dim sum",
  match: [/dumpling|gyoza|dim sum|ha ?cao|har ?gow|siu ?mai|shumai|momo|wonton|jiaozi|\bbao\b|bao bun/],
  base: [c("pita_bread", "base", g(8, 11, 15), "dough / wrapper"), c("pork_tenderloin_roasted", "protein", g(8, 12, 16), "filling"), c("oil_sesame", "fat", g(0, 0.5, 1.5))],
  options: [
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 20, defaultCount: 1, unit: "pcs", unknownLabel: "Number of pieces" },
    proteinGroup(["pork", "prawn", "chicken", "beef", "tofu"], "pork"),
    { id: "cooking", label: "Cooking", kind: "single", defaultChoice: "steamed", choices: [{ id: "steamed", label: "Steamed", ops: [] }, { id: "fried", label: "Pan-fried / fried", ops: [{ type: "add", component: c("oil_rapeseed", "fat", g(1, 2.5, 4)) }] }] },
  ],
  assumptions: ["Per piece ≈ 25 g: thin wheat wrapper and filling."],
  mainUncertainty: "Number of pieces",
  infer: (t) => {
    const s: Selections = { pieces: piecesFromText(t, 5) };
    inferProtein(t, ["pork", "prawn", "chicken", "beef", "tofu"], s);
    if (has(t, /gyoza|stekt|fried|pan/)) s.cooking = "fried";
    return s;
  },
};

const sushiMix: Archetype = {
  id: "sushi_mix",
  label: "Sushi / sashimi",
  match: [/sushi|sashimi|bento|\bbit\b|\bbiter\b|omakase|chirashi/],
  // Per piece; multiplied by the count.
  base: [c("ref_maki_salmon", "base", g(9, 12, 15), "half maki"), c("ref_nigiri_salmon", "protein", g(9, 12, 16), "half nigiri")],
  options: [
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 40, defaultCount: 1, unit: "pcs", unknownLabel: "Number of pieces" },
    {
      id: "type",
      label: "Type",
      kind: "single",
      defaultChoice: "mixed",
      choices: [
        { id: "mixed", label: "Mixed sushi", ops: [] },
        { id: "sashimi", label: "Sashimi (fish only)", ops: [{ type: "remove", role: "base" }, { type: "replaceRole", role: "protein", foodKey: "salmon_raw", gramsFactor: 1.25 }] },
        { id: "nigiri", label: "Nigiri", ops: [{ type: "remove", role: "base" }, { type: "scaleRole", role: "protein", factor: 2.5 }] },
        { id: "tempura", label: "Tempura / fried rolls", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_maki_tempura" }] },
      ],
    },
    { id: "dip", label: "Soy sauce", kind: "single", defaultChoice: "none", choices: [{ id: "none", label: "Not counted", ops: [] }, { id: "regular", label: "Dipped", ops: [{ type: "add", component: c("soy_sauce", "sauce", g(1, 2, 3.5)) }] }] },
  ],
  assumptions: ["Uses Matvaretabellen's analysed averages for salmon maki and nigiri, ~24 g per piece.", "Sashimi pieces assumed ~15 g of fish."],
  mainUncertainty: "Mix of pieces and piece size",
  infer: (t) => {
    const s: Selections = { pieces: piecesFromText(t, has(t, /\bbit\b/) ? 1 : has(t, /liten|small|mini/) ? 8 : has(t, /stor|large|big/) ? 20 : 12) };
    const m = t.match(/(\d{1,2})\s*(?:bit|biter)\b/);
    if (m) s.pieces = Number(m[1]);
    if (has(t, /sashimi/)) s.type = "sashimi";
    else if (has(t, /tempura|fritert|crispy/)) s.type = "tempura";
    return s;
  },
};

const pasta: Archetype = {
  id: "pasta",
  label: "Pasta",
  match: [/pasta|spaghetti|tagliatelle|linguine|penne|lasagn|ravioli|carbonara|bolognese|tortellini|gnocchi|rigatoni|fettuccine|pappardelle|tagliolini|fusilli|orecchiette|mac.?n.?cheese|macaroni/],
  base: [
    c("pasta_cooked", "base", g(180, 250, 330)),
    c("tomato_canned", "sauce", g(80, 120, 170)),
    c("oil_olive", "fat", g(5, 10, 20)),
    c("parmesan", "cheese", g(5, 10, 20)),
  ],
  options: [
    {
      id: "sauce",
      label: "Sauce",
      kind: "single",
      defaultChoice: "tomato",
      unknownLabel: undefined,
      choices: [
        { id: "tomato", label: "Tomato", ops: [] },
        { id: "cream", label: "Cream / alfredo", ops: [{ type: "replaceRole", role: "sauce", foodKey: "cream_18", gramsFactor: 0.65 }, { type: "scaleRole", role: "cheese", factor: 1.6 }] },
        { id: "pesto", label: "Pesto", ops: [{ type: "replaceRole", role: "sauce", foodKey: "pesto", gramsFactor: 0.3 }] },
        { id: "bolognese", label: "Bolognese / meat", ops: [{ type: "add", component: c("beef_mince_fried", "protein", g(70, 100, 140)) }] },
        { id: "carbonara", label: "Carbonara", ops: [{ type: "replaceRole", role: "sauce", foodKey: "cream_18", gramsFactor: 0.35 }, { type: "add", component: c("bacon_fried", "protein", g(25, 40, 60)) }, { type: "add", component: c("egg_boiled", "protein", g(20, 35, 50)) }, { type: "scaleRole", role: "cheese", factor: 1.8 }] },
        { id: "seafood", label: "Seafood", ops: [{ type: "add", component: c("king_prawn_raw", "protein", g(60, 90, 130)) }, { type: "scaleRole", role: "fat", factor: 1.5 }] },
        { id: "oil", label: "Oil & garlic", ops: [{ type: "remove", role: "sauce" }, { type: "scaleRole", role: "fat", factor: 2 }] },
        { id: "lasagne", label: "Lasagne", ops: [{ type: "scaleRole", role: "base", factor: 0.6 }, { type: "add", component: c("beef_mince_fried", "protein", g(70, 100, 130)) }, { type: "add", component: c("mozzarella", "cheese", g(30, 50, 75)) }, { type: "add", component: c("cream_18", "sauce", g(30, 50, 80), "béchamel") }] },
      ],
    },
    { id: "addons", label: "Add protein", kind: "multi", choices: [
      { id: "chicken", label: "Chicken", ops: [{ type: "add", component: c("chicken_fillet_cooked", "protein", g(70, 100, 140)) }] },
      { id: "prawns", label: "Prawns", ops: [{ type: "add", component: c("king_prawn_raw", "protein", g(50, 80, 110)) }] },
      { id: "salmon", label: "Salmon", ops: [{ type: "add", component: c("salmon_roasted", "protein", g(60, 90, 120)) }] },
    ] },
    sizeGroup(0.7, 1.3),
  ],
  referenceKey: "ref_pasta_arrabbiata",
  assumptions: ["About 250 g cooked pasta (≈100 g dry) per main course."],
  mainUncertainty: "Pasta portion, oil and cream",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /lasagn/)) s.sauce = "lasagne";
    else if (has(t, /carbonara|guanciale/)) s.sauce = "carbonara";
    else if (has(t, /bolognese|ragu|ragù|kjøtt|meat|salsiccia/)) s.sauce = "bolognese";
    else if (has(t, /pesto|genovese/)) s.sauce = "pesto";
    else if (has(t, /frutti di mare|scampi|reker|gamber|shrimp|prawn|cozze|vongole|sjømat|seafood|skalldyr/)) s.sauce = "seafood";
    else if (has(t, /fløte|krem|cream|alfredo|gorgonzola|formaggi|ost|cheese|mac/)) s.sauce = "cream";
    else if (has(t, /aglio|olio|hvitløk og olje/)) s.sauce = "oil";
    const add: string[] = [];
    if (has(t, /kylling|chicken|pollo/)) add.push("chicken");
    if (has(t, /laks|salmon|salmone/)) add.push("salmon");
    if (add.length) s.addons = add;
    return s;
  },
};

const risotto: Archetype = {
  id: "risotto",
  label: "Risotto",
  match: [/risotto|paella/],
  base: [c("rice_white_cooked", "base", g(200, 260, 330)), c("butter", "fat", g(8, 15, 25)), c("parmesan", "cheese", g(10, 20, 30)), c("cream_18", "sauce", g(0, 20, 40)), c("mushroom", "vegetable", g(30, 60, 90))],
  options: [
    { id: "addons", label: "With", kind: "multi", choices: [
      { id: "chicken", label: "Chicken", ops: [{ type: "add", component: c("chicken_fillet_cooked", "protein", g(70, 100, 140)) }] },
      { id: "seafood", label: "Seafood", ops: [{ type: "add", component: c("king_prawn_raw", "protein", g(60, 90, 130)) }] },
    ] },
    sizeGroup(0.7, 1.3),
  ],
  assumptions: ["Risotto is typically finished with butter and parmesan."],
  mainUncertainty: "Butter and cheese",
  infer: (t): Selections => {
    const add: string[] = [];
    if (has(t, /kylling|chicken|pollo/)) add.push("chicken");
    if (has(t, /scampi|reker|gamber|shrimp|prawn|sjømat|seafood|paella|frutti/)) add.push("seafood");
    return add.length ? { addons: add } : {};
  },
};

const MEX: ProteinId[] = ["beef", "chicken", "pork", "cod", "prawn", "legume"];

const tacos: Archetype = {
  id: "tacos",
  label: "Tacos",
  match: [/\btacos?\b|fajita/],
  base: [
    c("tortilla_wheat", "base", g(60, 90, 120), "3 small tortillas"),
    c("beef_mince_fried", "protein", g(70, 100, 140)),
    c("cheddar", "cheese", g(10, 25, 40)),
    c("sour_cream_18", "sauce", g(10, 25, 40)),
    c("tomato_canned", "sauce", g(20, 40, 60), "salsa"),
    c("lettuce_iceberg", "vegetable", g(15, 25, 40)),
    c("onion_raw", "vegetable", g(5, 15, 25)),
  ],
  options: [proteinGroup(MEX, "beef"), { id: "pieces", label: "Tacos", kind: "count", min: 1, max: 6, defaultCount: 3, unit: "tacos", unknownLabel: "Number of tacos" }, sauceGroup()],
  assumptions: ["Three small soft tortillas with filling, cheese, sour cream and salsa."],
  mainUncertainty: "Number of tacos and toppings",
  infer: (t) => {
    const s: Selections = {};
    inferProtein(t, MEX, s);
    const m = t.match(/(\d)\s*(?:stk|pcs|tacos)/);
    if (m) s.pieces = Number(m[1]);
    return s;
  },
};

const burrito: Archetype = {
  id: "burrito",
  label: "Burrito / bowl",
  match: [/burrito|chimichanga|enchilada|mexican bowl|meksikansk|burrito bowl/],
  base: [
    c("tortilla_wheat", "base", g(70, 90, 110), "large tortilla"),
    c("rice_white_cooked", "side", g(80, 120, 170)),
    c("black_beans", "vegetable", g(40, 60, 90)),
    c("beef_mince_fried", "protein", g(80, 120, 160)),
    c("cheddar", "cheese", g(15, 30, 45)),
    c("sour_cream_18", "sauce", g(15, 30, 45)),
    c("tomato_canned", "sauce", g(25, 40, 60), "salsa"),
  ],
  options: [
    proteinGroup(MEX, "beef"),
    { id: "form", label: "Served as", kind: "single", defaultChoice: "burrito", choices: [{ id: "burrito", label: "Burrito", ops: [] }, { id: "bowl", label: "Bowl (no tortilla)", ops: [{ type: "remove", role: "base" }, { type: "scaleRole", role: "side", factor: 1.4 }] }] },
    { id: "addons", label: "Add-ons", kind: "multi", choices: [{ id: "guac", label: "Guacamole", ops: [{ type: "add", component: c("avocado", "topping", g(25, 40, 60)) }] }] },
    sizeGroup(),
  ],
  assumptions: ["A typical burrito is 400–500 g with rice, beans, meat, cheese and sour cream."],
  mainUncertainty: "Portion size and toppings",
  infer: (t) => {
    const s: Selections = {};
    inferProtein(t, MEX, s);
    if (has(t, /bowl/)) s.form = "bowl";
    if (has(t, /guac|avokado|avocado/)) s.addons = ["guac"];
    return s;
  },
};

const quesadilla: Archetype = {
  id: "quesadilla",
  label: "Quesadilla / nachos",
  match: [/quesadilla|nachos/],
  base: [c("tortilla_wheat", "base", g(80, 110, 140)), c("cheddar", "cheese", g(50, 75, 100)), c("beef_mince_fried", "protein", g(40, 70, 100)), c("sour_cream_18", "sauce", g(15, 30, 45)), c("tomato_canned", "sauce", g(20, 40, 60), "salsa"), c("jalapeno", "vegetable", g(0, 10, 20))],
  options: [
    proteinGroup(MEX, "beef"),
    { id: "form", label: "Type", kind: "single", defaultChoice: "quesadilla", choices: [{ id: "quesadilla", label: "Quesadilla", ops: [] }, { id: "nachos", label: "Nachos", ops: [{ type: "replaceRole", role: "base", foodKey: "tortilla_chips", gramsFactor: 0.9 }] }] },
    sizeGroup(0.6, 1.4, "Starter or main size"),
  ],
  assumptions: ["Cheese-heavy; cheese and chips are the main calories."],
  mainUncertainty: "Cheese amount",
  infer: (t) => {
    const s: Selections = {};
    inferProtein(t, MEX, s);
    if (has(t, /nachos/)) s.form = "nachos";
    return s;
  },
};

const wings: Archetype = {
  id: "wings",
  label: "Wings / nuggets / fried chicken",
  match: [/wings|vinger|nuggets|fried chicken|chicken strips|tenders|popcorn chicken|kyllingbiter|crispy chicken|chicken bites/],
  // Per piece; multiplied by the count.
  base: [c("ref_chicken_nuggets", "protein", g(15, 22, 30), "per piece, edible weight")],
  options: [
    { id: "pieces", label: "Pieces", kind: "count", min: 1, max: 30, defaultCount: 1, unit: "pcs", unknownLabel: "Number of pieces" },
    { id: "addons", label: "Add-ons", kind: "multi", choices: [
      { id: "fries", label: "Fries", ops: [{ type: "add", component: c("french_fries", "side", g(15, 20, 30), "share per piece") }] },
      { id: "dip", label: "Dip", ops: [{ type: "add", component: c("mayonnaise", "sauce", g(2, 4, 6)) }] },
      { id: "glaze", label: "BBQ / honey glaze", ops: [{ type: "add", component: c("ketchup", "sauce", g(3, 5, 8)) }] },
    ] },
  ],
  assumptions: ["Approximated with Matvaretabellen's fast-food chicken nugget average (breaded, fried), ~22 g edible per piece."],
  mainUncertainty: "Piece size and breading",
  infer: (t) => {
    const s: Selections = { pieces: piecesFromText(t, 6) };
    const add: string[] = [];
    if (has(t, /pommes|fries|frites/)) add.push("fries");
    if (has(t, /dip|aioli|mayo|ranch/)) add.push("dip");
    if (has(t, /bbq|honey|honning|glaze|buffalo/)) add.push("glaze");
    if (add.length) s.addons = add;
    return s;
  },
};

const soup: Archetype = {
  id: "soup",
  label: "Soup",
  match: [/suppe|soup|bouillabaisse|chowder|tom yum|tom kha|gazpacho|bisque|minestrone/],
  base: [c("ref_vegetable_soup", "base", g(250, 350, 450))],
  options: [
    {
      id: "type",
      label: "Type",
      kind: "single",
      defaultChoice: "vegetable",
      choices: [
        { id: "vegetable", label: "Vegetable / creamy", ops: [] },
        { id: "fish", label: "Fish / seafood", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_fish_soup" }] },
        { id: "mushroom", label: "Mushroom", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_mushroom_soup" }] },
        { id: "lentil", label: "Lentil / bean", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_lentil_soup" }] },
        { id: "onion", label: "Onion", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_onion_soup" }] },
        { id: "miso", label: "Miso", ops: [{ type: "replaceRole", role: "base", foodKey: "miso", gramsFactor: 0.05, extra: [c("tofu", "protein", g(5, 15, 25)), c("spring_onion", "vegetable", g(2, 4, 6))] }] },
        { id: "coconut", label: "Coconut (tom kha)", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_vegetable_soup", extra: [c("coconut_milk", "sauce", g(40, 70, 100)), c("chicken_fillet_cooked", "protein", g(30, 50, 80))] }] },
      ],
    },
    { id: "size", label: "Size", kind: "single", defaultChoice: "main", unknownLabel: "Bowl size", narrows: "all", choices: [{ id: "starter", label: "Starter (~200 ml)", ops: [{ type: "scaleAll", factor: 0.6 }] }, { id: "main", label: "Main (~350 ml)", ops: [] }] },
    { id: "bread", label: "Bread", kind: "single", defaultChoice: "no", choices: [{ id: "no", label: "No bread", ops: [] }, { id: "yes", label: "With bread & butter", ops: [{ type: "add", component: c("bread_roll", "side", g(30, 45, 60)) }, { type: "add", component: c("butter", "fat", g(4, 8, 12)) }] }] },
  ],
  assumptions: ["Uses Matvaretabellen's analysed averages for comparable home-made soups."],
  mainUncertainty: "Bowl size and cream",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /fisk|fish|sjømat|seafood|bouillabaisse|chowder|reke|shrimp|bisque/)) s.type = "fish";
    else if (has(t, /sopp|mushroom|champignon/)) s.type = "mushroom";
    else if (has(t, /linse|lentil|bønne|bean|dal/)) s.type = "lentil";
    else if (has(t, /løk|onion/)) s.type = "onion";
    else if (has(t, /miso/)) s.type = "miso";
    else if (has(t, /tom kha|kokos|coconut/)) s.type = "coconut";
    if (has(t, /brød|bread/)) s.bread = "yes";
    return s;
  },
};

const dessert: Archetype = {
  id: "dessert",
  label: "Dessert",
  match: [/dessert|iskrem|softis|gelato|sorbet|ice cream|\w*(vanilje|sjokolade|jordbær|krokan|pistasj|bringebær)is\b|^is\b|\bis med\b|kake|cake|fondant|tiramisu|panna ?cotta|brownie|sjokolademousse|mousse|cr[eè]me br[uû]l[ée]e|cheesecake|\bpai\b|\bpie\b|vaffel|vafler|waffle|pannekake|pancake|cr[eê]pe|churros|mochi|baklava|kanelbolle|cinnamon roll|muffin|cookie|sjokolade\b|chocolate\b|trifle|karamellpudding|riskrem/],
  base: [c("ref_ice_cream", "base", g(70, 110, 160))],
  options: [
    {
      id: "type",
      label: "Type",
      kind: "single",
      defaultChoice: "icecream",
      choices: [
        { id: "icecream", label: "Ice cream / sorbet", ops: [] },
        { id: "cake", label: "Cake / brownie / fondant", ops: [{ type: "replaceRole", role: "base", foodKey: "ref_chocolate_cake", gramsFactor: 0.95 }] },
        { id: "creamy", label: "Creamy (tiramisu, cheesecake, panna cotta)", ops: [{ type: "replaceRole", role: "base", foodKey: "cream_cheese", gramsFactor: 0.35, extra: [c("cream_18", "sauce", g(25, 40, 60)), c("sugar_white", "sweetener", g(12, 20, 30)), c("bread_roll", "side", g(10, 20, 35), "biscuit base / sponge")] }] },
        { id: "waffle", label: "Waffle", ops: [{ type: "replaceRole", role: "base", foodKey: "waffles", gramsFactor: 0.9, extra: [c("sour_cream_18", "sauce", g(10, 25, 40)), c("sugar_white", "sweetener", g(10, 18, 28), "jam")] }] },
        { id: "pancake", label: "Pancakes / crêpes", ops: [{ type: "replaceRole", role: "base", foodKey: "pancakes", gramsFactor: 1.3, extra: [c("sugar_white", "sweetener", g(10, 20, 30), "syrup / jam")] }] },
        { id: "bun", label: "Pastry / bun", ops: [{ type: "replaceRole", role: "base", foodKey: "cinnamon_roll", gramsFactor: 0.8 }] },
      ],
    },
    { id: "addons", label: "Served with", kind: "multi", choices: [
      { id: "icecream", label: "Ice cream", ops: [{ type: "add", component: c("ref_ice_cream", "topping", g(30, 50, 70)) }] },
      { id: "cream", label: "Whipped cream", ops: [{ type: "add", component: c("cream_18", "topping", g(15, 30, 45)) }] },
    ] },
  ],
  assumptions: ["Restaurant dessert portion; sorbet is lower in fat than the ice-cream average used."],
  mainUncertainty: "Portion size",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /kake|cake|fondant|brownie|sjokolade|chocolate|muffin|cookie|baklava/)) s.type = "cake";
    else if (has(t, /tiramisu|panna ?cotta|cheesecake|mousse|cr[eè]me br|trifle|karamellpudding|riskrem/)) s.type = "creamy";
    else if (has(t, /vaffel|vafler|waffle|churros/)) s.type = "waffle";
    else if (has(t, /pannekake|pancake|cr[eê]pe/)) s.type = "pancake";
    else if (has(t, /kanelbolle|cinnamon roll|\bbolle\b|wienerbrød|croissant|pai\b|pie\b/)) s.type = "bun";
    const add: string[] = [];
    if (s.type && s.type !== "icecream" && has(t, /\bis\b|iskrem|ice cream|gelato/)) add.push("icecream");
    if (has(t, /krem\b|kremfløte|whipped|chantilly/)) add.push("cream");
    if (add.length) s.addons = add;
    return s;
  },
};

const drink: Archetype = {
  id: "drink",
  label: "Drink",
  match: [/\bcola\b|coca|pepsi|fanta|sprite|\bbrus\b|\bsolo\b|urge|mozell|ginger ale|tonic|juice|\bjus\b|smoothie|lassi|milkshake|kaffe|coffee|espresso|americano|macchiato|\bte\b|\btea\b|chai|matcha|-te\b|\bøl\b|beer|pils|lager|\bipa\b|cider|\bvin\b|wine|prosecco|cava|champagne|\bvann\b|water|bonaqua|farris|imsdal|mineralvann|zero|lettbrus/],
  base: [c("cola", "drink", g(330, 500, 500))],
  options: [
    {
      id: "type",
      label: "Drink",
      kind: "single",
      defaultChoice: "soda",
      choices: [
        { id: "soda", label: "Soft drink (sugar)", ops: [] },
        { id: "zero", label: "Zero / water", ops: [{ type: "replaceRole", role: "drink", foodKey: "tea_black" }] },
        { id: "juice", label: "Juice", ops: [{ type: "replaceRole", role: "drink", foodKey: "orange_juice", gramsFactor: 0.6 }] },
        { id: "coffee", label: "Coffee / espresso", ops: [{ type: "replaceRole", role: "drink", foodKey: "coffee", gramsFactor: 0.4 }] },
        { id: "tea", label: "Tea", ops: [{ type: "replaceRole", role: "drink", foodKey: "tea_black", gramsFactor: 0.6 }] },
        { id: "beer", label: "Beer", ops: [{ type: "replaceRole", role: "drink", foodKey: "beer_pilsner", gramsFactor: 0.9 }] },
        { id: "wine", label: "Wine (glass)", ops: [{ type: "replaceRole", role: "drink", foodKey: "wine_red", gramsFactor: 0.3 }] },
        { id: "white", label: "White / sparkling wine", ops: [{ type: "replaceRole", role: "drink", foodKey: "wine_white", gramsFactor: 0.3 }] },
        { id: "shake", label: "Smoothie / lassi / milkshake", ops: [{ type: "replaceRole", role: "drink", foodKey: "milk_whole", gramsFactor: 0.5, extra: [c("sugar_white", "sweetener", g(10, 25, 40)), c("banana", "topping", g(0, 50, 100))] }] },
      ],
    },
    { id: "size", label: "Size", kind: "single", defaultChoice: "regular", unknownLabel: "Size", narrows: "all", choices: [{ id: "small", label: "Small (0.33 l)", ops: [{ type: "scaleAll", factor: 0.66 }] }, { id: "regular", label: "Regular (0.5 l)", ops: [] }] },
  ],
  assumptions: ["Soft drinks assume the sugared version unless it says zero / light / water."],
  mainUncertainty: "Size",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /zero|light|lett|max\b|vann|water|bonaqua|farris|imsdal|mineral|diet/)) s.type = "zero";
    else if (has(t, /smoothie|lassi|milkshake|shake/)) s.type = "shake";
    else if (has(t, /juice|\bjus\b/)) s.type = "juice";
    else if (has(t, /kaffe|coffee|espresso|americano|macchiato/)) s.type = "coffee";
    else if (has(t, /\bte\b|\btea\b|chai|matcha|-te\b|jasmin|sencha|earl grey/)) s.type = "tea";
    else if (has(t, /øl|beer|pils|lager|\bipa\b|cider/)) s.type = "beer";
    else if (has(t, /hvitvin|white wine|prosecco|cava|champagne|musserende|bobler/)) s.type = "white";
    else if (has(t, /\bvin\b|wine|rødvin/)) s.type = "wine";
    if (has(t, /0[,.]33|33 ?cl|\bboks\b|\bcan\b|liten|small/)) s.size = "small";
    return s;
  },
};

const sandwich: Archetype = {
  id: "sandwich",
  label: "Sandwich / smørbrød",
  match: [/smørbrød|smorbrod|sandwich|baguette|panini|toast|ciabatta|bagel|croque|club\b|\bwrap\b|wrap$|rundstykke|focaccia med/],
  base: [
    c("bread_roll", "base", g(60, 85, 110)),
    c("butter", "fat", g(3, 7, 12)),
    c("ham_boiled", "protein", g(25, 40, 60)),
    c("cheddar", "cheese", g(10, 20, 30)),
    c("lettuce_iceberg", "vegetable", g(10, 20, 30)),
    c("tomato_raw", "vegetable", g(10, 20, 30)),
    c("mayonnaise", "sauce", g(0, 10, 20), "dressing"),
  ],
  options: [
    {
      id: "filling",
      label: "Filling",
      kind: "single",
      defaultChoice: "hamcheese",
      choices: [
        { id: "hamcheese", label: "Ham & cheese", ops: [] },
        { id: "chicken", label: "Chicken", ops: [{ type: "replaceRole", role: "protein", foodKey: "chicken_fillet_cooked", gramsFactor: 1.8 }] },
        { id: "shrimp", label: "Shrimp & mayo (rekesmørbrød)", ops: [{ type: "replaceRole", role: "protein", foodKey: "king_prawn_raw", gramsFactor: 2.5 }, { type: "remove", role: "cheese" }, { type: "scaleRole", role: "sauce", factor: 2 }] },
        { id: "salmon", label: "Salmon", ops: [{ type: "replaceRole", role: "protein", foodKey: "salmon_raw", gramsFactor: 1.6 }, { type: "remove", role: "cheese" }] },
        { id: "beef", label: "Roast beef", ops: [{ type: "replaceRole", role: "protein", foodKey: "beef_striploin_roasted", gramsFactor: 1.6 }] },
        { id: "egg", label: "Egg", ops: [{ type: "replaceRole", role: "protein", foodKey: "egg_boiled", gramsFactor: 1.5 }] },
        { id: "veg", label: "Vegetarian / cheese", ops: [{ type: "remove", role: "protein" }, { type: "scaleRole", role: "cheese", factor: 2 }] },
      ],
    },
    { id: "bread", label: "Bread", kind: "single", defaultChoice: "roll", choices: [{ id: "roll", label: "Roll / ciabatta", ops: [] }, { id: "baguette", label: "Baguette", ops: [{ type: "replaceRole", role: "base", foodKey: "baguette", gramsFactor: 1.2 }] }, { id: "open", label: "One slice (smørbrød)", ops: [{ type: "scaleRole", role: "base", factor: 0.6 }] }, { id: "wrap", label: "Wrap", ops: [{ type: "replaceRole", role: "base", foodKey: "tortilla_wheat" }] }] },
    sizeGroup(),
  ],
  assumptions: ["Filling amounts are typical café portions."],
  mainUncertainty: "Filling and dressing",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /reke|shrimp|skagen/)) s.filling = "shrimp";
    else if (has(t, /laks|salmon/)) s.filling = "salmon";
    else if (has(t, /kylling|chicken|club/)) s.filling = "chicken";
    else if (has(t, /roastbiff|roast beef|biff|beef|karbonade/)) s.filling = "beef";
    else if (has(t, /\begg\b|eggerøre/)) s.filling = "egg";
    else if (has(t, /vegetar|veggie|mozzarella|caprese|brie/)) s.filling = "veg";
    if (has(t, /baguette/)) s.bread = "baguette";
    else if (has(t, /smørbrød|smorbrod|skagen/)) s.bread = "open";
    else if (has(t, /wrap/)) s.bread = "wrap";
    return s;
  },
};

const side: Archetype = {
  id: "side",
  label: "Side",
  match: [/^(\d+\.\s*)?(pommes( frites)?|fries|frites|chips|potetbåter|wedges|søtpotetfries|sweet potato fries|ris|rice|basmati( ris)?|kokt ris|stekt ris|salat|side salad|coleslaw|edamame|edamme bønner|grønnsaker|vegetables|potetmos|mashed potatoes)$/],
  base: [c("french_fries", "base", g(100, 150, 200))],
  options: [
    {
      id: "type",
      label: "Side",
      kind: "single",
      defaultChoice: "fries",
      choices: [
        { id: "fries", label: "Fries", ops: [] },
        { id: "sweet", label: "Sweet potato fries", ops: [{ type: "replaceRole", role: "base", foodKey: "sweet_potato_roasted", extra: [c("oil_rapeseed", "fat", g(6, 12, 18))] }] },
        { id: "rice", label: "Rice", ops: [{ type: "replaceRole", role: "base", foodKey: "rice_white_cooked", gramsFactor: 1.3 }] },
        { id: "salad", label: "Salad", ops: [{ type: "replaceRole", role: "base", foodKey: "lettuce_iceberg", gramsFactor: 0.6, extra: [c("oil_olive", "fat", g(3, 6, 10))] }] },
        { id: "edamame", label: "Edamame", ops: [{ type: "replaceRole", role: "base", foodKey: "edamame", gramsFactor: 0.7 }] },
        { id: "mash", label: "Mash", ops: [{ type: "replaceRole", role: "base", foodKey: "potatoes_mashed", gramsFactor: 1.2 }] },
        { id: "veg", label: "Vegetables", ops: [{ type: "replaceRole", role: "base", foodKey: "broccoli_cooked", gramsFactor: 0.8, extra: [c("butter", "fat", g(0, 5, 10))] }] },
      ],
    },
    sizeGroup(0.7, 1.4),
  ],
  assumptions: ["Side portion as typically served."],
  mainUncertainty: "Portion size",
  infer: (t) => {
    const s: Selections = {};
    if (has(t, /søtpotet|sweet potato/)) s.type = "sweet";
    else if (has(t, /\bris\b|rice|basmati/)) s.type = "rice";
    else if (has(t, /salat|salad|coleslaw/)) s.type = "salad";
    else if (has(t, /edam/)) s.type = "edamame";
    else if (has(t, /mos|mash/)) s.type = "mash";
    else if (has(t, /grønnsak|vegetable/)) s.type = "veg";
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
  sushiMix,
  boba,
  latte,
  pizza,
  burger,
  curry,
  tandoori,
  naan,
  dumplings,
  friedSnack,
  noodles,
  pasta,
  risotto,
  tacos,
  burrito,
  quesadilla,
  wings,
  soup,
  caesar,
  dessert,
  drink,
  sandwich,
  riceBowl,
  meatStarter,
  side,
  fishMain,
  meatMain,
  genericPlate,
];

export const ARCHETYPE_IDS = ARCHETYPES.map((a) => a.id);

export function getArchetype(id: string | null | undefined): Archetype | undefined {
  return ARCHETYPES.find((a) => a.id === id);
}

/** Matches on the dish name first, so "Veggie burger (falafel patty)" is a burger, not a falafel wrap. */
export function detectArchetype(name: string, description = ""): Archetype | undefined {
  const find = (t: string) => ARCHETYPES.find((a) => a.match.some((re) => re.test(t)));
  const full = `${name} ${description}`.toLowerCase();
  // "Laks — 1 bit" on a sushi menu is a piece of sushi, not a salmon dinner.
  if (/\b\d+\s*(?:bit|biter)\b/.test(full)) return find(full);
  // Drinks are only recognised from the dish name — descriptions mention "te", "vin" etc. too often.
  const fromDescription = ARCHETYPES.find((a) => a.id !== "drink" && a.match.some((re) => re.test(full)));
  return find(name.toLowerCase()) ?? fromDescription;
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
