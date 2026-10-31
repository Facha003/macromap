/** Shared types for website menus (safe to import in the browser). */
import type { ParsedDish } from "./menuParse";

export type MenuMethod = "jsonld" | "ai" | "parser";
export type MenuStatus = "found" | "none" | "blocked" | "no-text" | "error";

export interface WebsiteMenu {
  restaurantId: string;
  sourceUrl: string;
  checkedAt: string;
  method: MenuMethod;
  dishes: ParsedDish[];
}

export interface MenuIndexEntry {
  checkedAt: string;
  status: MenuStatus;
  dishes: number;
  sourceUrl: string | null;
  method?: MenuMethod;
}

export type MenuIndex = Record<string, MenuIndexEntry>;

/** File name for a restaurant id like "osm:node/123" → "osm_node_123". */
export const menuFileName = (restaurantId: string) => restaurantId.replace(/[^a-zA-Z0-9]+/g, "_");

const WEB_PREFIX = "web:";

/** Id of the n-th dish of a restaurant's website menu (restaurant ids contain ":", so n goes first). */
export const webDishId = (restaurantId: string, n: number) => `${WEB_PREFIX}${n}:${restaurantId}`;

export function parseWebDishId(id: string): { n: number; restaurantId: string } | null {
  if (!id.startsWith(WEB_PREFIX)) return null;
  const rest = id.slice(WEB_PREFIX.length);
  const i = rest.indexOf(":");
  const n = Number(rest.slice(0, i));
  return i > 0 && Number.isInteger(n) ? { n, restaurantId: rest.slice(i + 1) } : null;
}

