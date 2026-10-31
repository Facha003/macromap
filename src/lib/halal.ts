import type { FoodKey } from "./nutrition/catalog";
import type { Component } from "./nutrition/types";

/**
 * Where a halal classification comes from. Only the first three are affirmative evidence.
 *   restaurant — the restaurant itself states it (e.g. a halal menu section / item data)
 *   osm        — tagged diet:halal=yes|only on OpenStreetMap (community map data)
 *   reported   — the user marked it halal on this device (personal, not independent)
 *   possible   — cuisine where halal meat is common; NOT evidence, never shown in strict mode
 *   not        — tagged or reported as not halal
 *   unknown    — no information
 */
export type HalalStatus = "restaurant" | "osm" | "reported" | "possible" | "not" | "unknown";
export type HalalReport = "halal" | "not";

const LIKELY_CUISINES = new Set([
  "kebab", "turkish", "middle_eastern", "lebanese", "arab", "arabic", "syrian", "iraqi", "persian", "iranian", "afghan",
  "pakistani", "somali", "moroccan", "kurdish", "egyptian", "palestinian", "yemeni", "shawarma", "falafel", "halal", "eritrean",
]);
const LIKELY_NAME = /\b(kebab|kebap|shawarma|shawerma|falafel|döner|doner|dürüm|durum|kurdish|afghan|persian|lebanese|libanesisk|tyrkisk|turkish|pakistani|somali)\b/i;
const NAME_SAYS_HALAL = /\bhalal\b/i;

export interface HalalSubject {
  name: string;
  cuisines: string[];
  /** OSM diet:halal value */
  halalTag?: string | null;
  /** The restaurant's own data says halal (e.g. menu item flag or "halal" in its name). */
  statedHalal?: boolean;
}

export interface HalalEvidence {
  status: HalalStatus;
  /** Short badge text. */
  label: string;
  /** Plain-language explanation of where this comes from. */
  source: string;
}

export function halalStatus(r: HalalSubject, report?: HalalReport | null): HalalEvidence {
  if (report === "not") return { status: "not", label: "Not halal", source: "You marked this restaurant as not halal (saved on this device)" };
  if (r.statedHalal || NAME_SAYS_HALAL.test(r.name)) return { status: "restaurant", label: "Halal · restaurant", source: "The restaurant itself says it is halal" };
  if (r.halalTag === "yes" || r.halalTag === "only") return { status: "osm", label: "Halal · OSM tag", source: "Tagged halal on OpenStreetMap (community-maintained map data)" };
  if (report === "halal") return { status: "reported", label: "Halal · your report", source: "You marked this restaurant as halal (saved on this device, not independently checked)" };
  if (r.halalTag === "no") return { status: "not", label: "Not halal", source: "Tagged not halal on OpenStreetMap" };
  if (r.cuisines.some((c) => LIKELY_CUISINES.has(c)) || LIKELY_NAME.test(r.name)) {
    return { status: "possible", label: "Possibly halal", source: "Unconfirmed — only the cuisine suggests it. Cuisine is not evidence; ask the restaurant" };
  }
  return { status: "unknown", label: "", source: "No halal information" };
}

/** Affirmative evidence only (restaurant, OSM tag, or the user's own report). */
export const isConfirmedHalal = (s: HalalStatus) => s === "restaurant" || s === "osm" || s === "reported";

/** Strict by default; "possibly halal" places only when the user opts in. */
export const passesHalalFilter = (s: HalalStatus, includePossible = false) => isConfirmedHalal(s) || (includePossible && s === "possible");

const PORK = new Set<FoodKey>(["bacon_fried", "ham_boiled", "pepperoni", "pork_tenderloin_roasted", "ref_pasta_carbonara", "beer_pilsner", "wine_red", "wine_white"]);

/**
 * True if the estimated recipe contains pork or alcohol. Used only to HIDE dishes in
 * halal mode — the absence of pork is never treated as evidence that meat is halal.
 */
export function containsPork(components: Component[]): boolean {
  return components.some((c) => PORK.has(c.foodKey) && c.grams.likely > 0);
}
