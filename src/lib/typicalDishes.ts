/**
 * "Typical dishes" for restaurants we have no menu for. They are generic dishes
 * for that kind of place — clearly labelled in the UI as NOT the restaurant's
 * menu — so every restaurant shows something useful while its real menu is missing.
 */
export type RestaurantKind = "kebab" | "pizza" | "burger" | "sushi" | "asian" | "cafe" | "boba" | "salad" | "indian" | "mexican";

export interface TypicalDish {
  slug: string;
  name: string;
  description: string;
}

const KIND_LABEL: Record<RestaurantKind, string> = {
  kebab: "kebab places",
  pizza: "pizzerias",
  burger: "burger places",
  sushi: "sushi restaurants",
  asian: "Asian restaurants",
  cafe: "cafés",
  boba: "bubble tea shops",
  salad: "salad bars",
  indian: "Indian restaurants",
  mexican: "Mexican restaurants",
};

const DISHES: Record<RestaurantKind, TypicalDish[]> = {
  kebab: [
    { slug: "durum", name: "Kebab dürüm (wrap)", description: "Döner meat, salad and garlic sauce in a wrap" },
    { slug: "chicken-wrap", name: "Chicken kebab wrap", description: "Grilled chicken, salad and garlic sauce in a wrap" },
    { slug: "pita", name: "Kebab in pita", description: "Döner meat, salad and garlic sauce in pita bread" },
    { slug: "plate", name: "Kebab plate with rice", description: "Döner meat with rice, salad and garlic sauce" },
    { slug: "chicken-plate", name: "Chicken kebab plate with fries", description: "Grilled chicken with fries, salad and garlic sauce" },
    { slug: "falafel", name: "Falafel wrap", description: "Falafel, hummus, tahini and salad in a wrap" },
  ],
  pizza: [
    { slug: "margherita", name: "Margherita pizza", description: "Tomato, mozzarella, basil — about 30 cm" },
    { slug: "chicken", name: "Chicken & mushroom pizza", description: "Tomato, mozzarella, chicken, mushrooms — about 30 cm" },
    { slug: "veg", name: "Vegetarian pizza", description: "Tomato, mozzarella, peppers, onion, mushroom — about 30 cm" },
    { slug: "pepperoni", name: "Pepperoni pizza", description: "Tomato, mozzarella, pepperoni — about 30 cm" },
    { slug: "caesar", name: "Chicken caesar salad", description: "Lettuce, grilled chicken, parmesan, croutons, caesar dressing" },
  ],
  burger: [
    { slug: "cheeseburger", name: "Cheeseburger", description: "Beef patty, cheddar, lettuce, tomato, onion, burger sauce" },
    { slug: "cheeseburger-fries", name: "Cheeseburger with fries", description: "Beef patty, cheddar, burger sauce, side of fries" },
    { slug: "crispy-chicken", name: "Crispy chicken burger", description: "Fried chicken fillet, lettuce, mayo" },
    { slug: "grilled-chicken", name: "Grilled chicken burger", description: "Grilled chicken breast, lettuce, tomato, mayo — no cheese" },
    { slug: "veggie", name: "Veggie burger", description: "Falafel patty, lettuce, tomato, vegan mayo" },
  ],
  sushi: [
    { slug: "nigiri-salmon", name: "Salmon nigiri (8 pcs)", description: "Salmon on seasoned rice" },
    { slug: "maki-salmon", name: "Salmon maki (8 pcs)", description: "Salmon roll" },
    { slug: "california", name: "California roll (8 pcs)", description: "Surimi crab, avocado, cucumber" },
    { slug: "poke", name: "Salmon poke bowl", description: "Sushi rice, salmon, avocado, edamame, cucumber, sesame, soy dressing" },
    { slug: "teriyaki", name: "Chicken teriyaki bowl", description: "Chicken thigh, teriyaki sauce, rice and broccoli" },
  ],
  asian: [
    { slug: "pad-thai-chicken", name: "Chicken pad thai", description: "Rice noodles, chicken, egg, spring onion" },
    { slug: "pad-thai-prawn", name: "Pad thai with prawns", description: "Rice noodles, prawns, egg, spring onion" },
    { slug: "fried-rice", name: "Chicken fried rice", description: "Wok-fried rice with chicken, egg and vegetables" },
    { slug: "beef-noodles", name: "Beef egg noodles", description: "Wok-fried egg noodles with beef and vegetables" },
    { slug: "tofu-wok", name: "Tofu wok", description: "Wok-fried rice noodles with tofu and vegetables" },
    { slug: "teriyaki", name: "Chicken teriyaki bowl", description: "Chicken thigh, teriyaki sauce, rice and broccoli" },
  ],
  cafe: [
    { slug: "latte", name: "Caffè latte", description: "Double espresso with steamed whole milk" },
    { slug: "cappuccino", name: "Cappuccino", description: "Espresso with steamed whole milk and foam" },
    { slug: "oat-latte", name: "Oat latte", description: "Double espresso with oat milk" },
    { slug: "salad", name: "Chicken caesar salad", description: "Lettuce, grilled chicken, parmesan, croutons, caesar dressing" },
  ],
  boba: [
    { slug: "classic", name: "Classic milk tea with pearls", description: "Black tea, milk, tapioca pearls" },
    { slug: "brown-sugar", name: "Brown sugar milk tea", description: "Fresh milk, brown sugar syrup and tapioca pearls" },
    { slug: "fruit", name: "Fruit tea with pearls", description: "Green tea, passion fruit, with pearls" },
  ],
  indian: [
    { slug: "tikka-masala", name: "Chicken tikka masala", description: "Chicken in a creamy tomato masala sauce, served with rice" },
    { slug: "butter-chicken", name: "Butter chicken", description: "Chicken in a mild creamy tomato sauce, served with rice" },
    { slug: "lamb-curry", name: "Lamb curry", description: "Lamb in a spiced tomato curry, served with rice" },
    { slug: "dal", name: "Dal", description: "Lentil curry, served with rice" },
    { slug: "tandoori", name: "Tandoori chicken", description: "Chicken grilled in the tandoor with yoghurt marinade" },
    { slug: "naan", name: "Garlic naan", description: "Naan with garlic butter" },
  ],
  mexican: [
    { slug: "tacos", name: "Beef tacos (3)", description: "Three soft tortillas with beef, cheese, sour cream and salsa" },
    { slug: "burrito", name: "Chicken burrito", description: "Chicken, rice, beans, cheese, sour cream and salsa" },
    { slug: "quesadilla", name: "Chicken quesadilla", description: "Tortilla with cheese and chicken" },
    { slug: "nachos", name: "Nachos", description: "Tortilla chips with cheese, beef, sour cream and jalapeño" },
  ],
  salad: [
    { slug: "caesar", name: "Chicken caesar salad", description: "Lettuce, grilled chicken, parmesan, croutons, caesar dressing" },
    { slug: "salmon", name: "Salmon salad bowl", description: "Roasted salmon, leafy greens, tomato, avocado, oil & vinegar" },
    { slug: "poke", name: "Salmon poke bowl", description: "Sushi rice, salmon, avocado, edamame, cucumber, sesame, soy dressing" },
  ],
};

const BY_CUISINE: [RegExp, RestaurantKind][] = [
  [/^(indian|pakistani|nepalese|sri_lankan|bangladeshi|tandoori|curry)$/, "indian"],
  [/^(mexican|tex-mex|tex_mex|burrito|taco|latin_american)$/, "mexican"],
  [/^(kebab|turkish|middle_eastern|lebanese|arab|syrian|persian|afghan|kurdish|shawarma|falafel|greek)$/, "kebab"],
  [/^(pizza|italian|italian_pizza|pasta)$/, "pizza"],
  [/^(burger|american|chicken|barbecue|grill|diner|fish_and_chips)$/, "burger"],
  [/^(sushi|japanese|poke)$/, "sushi"],
  [/^(thai|chinese|asian|vietnamese|korean|noodle|wok|ramen|indonesian|malaysian)$/, "asian"],
  [/^(bubble_tea|tea)$/, "boba"],
  [/^(coffee_shop|cafe|bakery|cake|pastry|breakfast|sandwich|donut|waffle)$/, "cafe"],
  [/^(salad|healthy|vegan|vegetarian)$/, "salad"],
];

const BY_NAME: [RegExp, RestaurantKind][] = [
  [/india|tandoori|masala|curry|punjab|nepal|himalaya|bombay|mumbai|delhi|taj\b|mahal/i, "indian"],
  [/mexic|taco|burrito|cantina|tex.?mex/i, "mexican"],
  [/kebab|kebap|shawarma|shawerma|falafel|döner|dürüm|durum|grill house/i, "kebab"],
  [/pizz/i, "pizza"],
  [/burger/i, "burger"],
  [/sushi|poke/i, "sushi"],
  [/thai|wok|noodle|nudler|asia|china|kina|vietnam|pho|ramen/i, "asian"],
  [/boba|bubble/i, "boba"],
  [/caf[eé]|kaf[eé]|kaffe|coffee|espresso|bakeri|bakery|konditori/i, "cafe"],
  [/salat|salad/i, "salad"],
];

export function restaurantKind(r: { name: string; cuisines: string[]; amenity?: string | null }): RestaurantKind | null {
  for (const c of r.cuisines) for (const [re, k] of BY_CUISINE) if (re.test(c)) return k;
  for (const [re, k] of BY_NAME) if (re.test(r.name)) return k;
  if (r.amenity === "cafe") return "cafe";
  return null;
}

export function typicalDishesFor(r: { name: string; cuisines: string[]; amenity?: string | null }): { kind: RestaurantKind; label: string; dishes: TypicalDish[] } | null {
  const kind = restaurantKind(r);
  return kind ? { kind, label: KIND_LABEL[kind], dishes: DISHES[kind] } : null;
}

const PREFIX = "typical:";

/** Restaurant ids contain ":" themselves, so the slug goes first. */
export function typicalId(restaurantId: string, slug: string): string {
  return `${PREFIX}${slug}:${restaurantId}`;
}

export function parseTypicalId(id: string): { slug: string; restaurantId: string } | null {
  if (!id.startsWith(PREFIX)) return null;
  const rest = id.slice(PREFIX.length);
  const i = rest.indexOf(":");
  return i > 0 ? { slug: rest.slice(0, i), restaurantId: rest.slice(i + 1) } : null;
}

export function typicalDish(r: { name: string; cuisines: string[]; amenity?: string | null }, slug: string): { dish: TypicalDish; label: string } | null {
  const t = typicalDishesFor(r);
  const dish = t?.dishes.find((d) => d.slug === slug);
  return t && dish ? { dish, label: t.label } : null;
}
