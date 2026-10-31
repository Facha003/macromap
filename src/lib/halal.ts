import type { FoodKey } from "./nutrition/catalog";
import type { Component } from "./nutrition/types";

/**
 * confirmed — the restaurant is tagged halal (OpenStreetMap) or the user said so
 * likely    — cuisine where halal meat is common in Norway (kebab, Turkish, Middle Eastern…), NOT verified
 * not       — tagged or reported as not halal
 * unknown   — no information
 */
export type HalalStatus = "confirmed" | "likely" | "not" | "unknown";
export type HalalReport = "halal" | "not";

const LIKELY_CUISINES = new Set([
  "kebab", "turkish", "middle_eastern", "lebanese", "arab", "arabic", "syrian", "iraqi", "persian", "iranian", "afghan",
  "pakistani", "somali", "moroccan", "kurdish", "egyptian", "palestinian", "yemeni", "shawarma", "falafel", "halal", "eritrean",
]);
const LIKELY_NAME = /\b(halal|kebab|kebap|shawarma|shawerma|falafel|döner|doner|dürüm|durum|kurdish|afghan|persian|lebanese|libanesisk|tyrkisk|turkish|pakistani|somali)\b/i;

export interface HalalSubject {
  name: string;
  cuisines: string[];
  /** OSM diet:halal value */
  halalTag?: string | null;
}

export function halalStatus(r: HalalSubject, report?: HalalReport | null): { status: HalalStatus; source: string } {
  if (report === "halal") return { status: "confirmed", source: "You marked this restaurant as halal" };
  if (report === "not") return { status: "not", source: "You marked this restaurant as not halal" };
  if (r.halalTag === "yes" || r.halalTag === "only") return { status: "confirmed", source: "Tagged halal on OpenStreetMap" };
  if (r.halalTag === "no") return { status: "not", source: "Tagged not halal on OpenStreetMap" };
  if (r.cuisines.some((c) => LIKELY_CUISINES.has(c)) || LIKELY_NAME.test(r.name)) {
    return { status: "likely", source: "Cuisine where halal meat is common — not confirmed, ask the restaurant" };
  }
  return { status: "unknown", source: "No halal information" };
}

export const isHalalOption = (s: HalalStatus) => s === "confirmed" || s === "likely";

const PORK = new Set<FoodKey>(["bacon_fried", "ham_boiled", "pepperoni"]);

/** True if the estimated recipe contains pork products. */
export function containsPork(components: Component[]): boolean {
  return components.some((c) => PORK.has(c.foodKey) && c.grams.likely > 0);
}
