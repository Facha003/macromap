/**
 * Pure helpers for reading menus from restaurants' own websites
 * (used by scripts/crawl-menus.ts; unit-tested in tests/websiteMenu.test.ts).
 */
import { parse, type HTMLElement, type TextNode } from "node-html-parser";
import { z } from "zod";
import type { ParsedDish } from "./menuParse";

export type { MenuIndex, MenuIndexEntry, MenuMethod, MenuStatus, WebsiteMenu } from "./websiteMenuTypes";
export { menuFileName } from "./websiteMenuTypes";

const price = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".").replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n < 2000 ? n : null;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Allergen-code lists like "(G | M | S)" or "G, M, SE" are not descriptions.
const ALLERGEN_CODES = /^\(?\s*([A-ZÆØÅ]{1,3}|\d{1,2})(\s*[|,/]\s*([A-ZÆØÅ]{1,3}|\d{1,2}))*\s*\)?$/;

/** Plausible dish name: real words, not a price fragment, add-on or heading. */
export function isDishName(name: string): boolean {
  const letters = (name.match(/\p{L}/gu) ?? []).length;
  if (letters < 3 || letters < name.replace(/\s/g, "").length * 0.5) return false;
  if (/[+:]\s*$|^\s*[+(]|^(med|with|uten|tillegg|extra|ekstra|serveres|served|spør|ask|se |see |pris|price)\b/i.test(name)) return false;
  return true;
}

export function dedupeDishes(dishes: ParsedDish[], limit = 80): ParsedDish[] {
  const seen = new Set<string>();
  return dishes
    .map((d) => ({ ...d, description: d.description && !ALLERGEN_CODES.test(d.description.trim()) ? d.description : null }))
    .filter((d) => d.name.length >= 2 && d.name.length <= 120 && isDishName(d.name))
    .filter((d) => {
      const k = d.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

/** schema.org Menu / MenuSection / MenuItem in JSON-LD — exact data, no guessing. */
export function extractJsonLdMenu(html: string): ParsedDish[] {
  const out: ParsedDish[] = [];
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const o = node as Record<string, unknown>;
    const type = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (type.includes("MenuItem")) {
      const offers = ([] as unknown[]).concat(o.offers ?? [])[0] as Record<string, unknown> | undefined;
      const name = text(o.name, 120);
      if (name) out.push({ name, description: text(o.description, 500) || null, priceNok: price(offers?.price) });
    }
    for (const k of ["@graph", "hasMenu", "hasMenuSection", "hasMenuItem", "mainEntity", "menu"]) visit(o[k]);
  };
  for (const b of blocks) {
    try {
      visit(JSON.parse(b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "")));
    } catch {
      /* invalid JSON-LD — ignore */
    }
  }
  return dedupeDishes(out);
}

const BLOCK = new Set(["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "br", "td", "th", "dt", "dd", "header", "table", "ul", "ol"]);

/** Visible text with one block per line; navigation, scripts and footers removed. */
export function htmlToText(html: string): string {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  root.querySelectorAll("script,style,noscript,nav,footer,svg,form,iframe,template,[aria-hidden=true]").forEach((n) => n.remove());
  const lines: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.replace(/\s+/g, " ").trim();
    if (t) lines.push(t);
    buf = "";
  };
  const walk = (n: HTMLElement) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) buf += ` ${(c as TextNode).text}`;
      else if (c.nodeType === 1) {
        const tag = (c as HTMLElement).rawTagName?.toLowerCase();
        if (BLOCK.has(tag)) flush();
        walk(c as HTMLElement);
        if (BLOCK.has(tag)) flush();
      }
    }
  };
  walk(root);
  flush();
  return lines.join("\n");
}

const MENU_WORDS = /\b(meny|menyer|menu|menus|mat|lunsj|lunch|middag|dinner|spisekart|food|takeaway|ta med|retter|à la carte|a la carte)\b/i;
const SKIP_HOSTS = /(wolt\.com|foodora\.|just-eat|justeat|facebook\.com|instagram\.com|tripadvisor|google\.|ubereats|tiktok|twitter|x\.com|linkedin|youtube)/i;

/** Same-site links that look like a menu page, best first. */
export function menuLinks(html: string, baseUrl: string, max = 3): string[] {
  const base = new URL(baseUrl);
  const root = parse(html);
  const scored = new Map<string, number>();
  for (const a of root.querySelectorAll("a[href]")) {
    let url: URL;
    try {
      url = new URL(a.getAttribute("href")!, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    url.hash = "";
    const label = `${a.text} ${url.pathname}`;
    let score = 0;
    if (MENU_WORDS.test(a.text)) score += 3;
    if (MENU_WORDS.test(decodeURIComponent(url.pathname).replace(/[-_/]/g, " "))) score += 2;
    if (/\.pdf$/i.test(url.pathname) && MENU_WORDS.test(label)) score += 2;
    if (/drikke|drinks|wine|vin|bar|cocktail|catering|selskap|jobb|career|kontakt|contact|booking|bord/i.test(label)) score -= 2;
    if (score > 1 && url.href !== base.href) scored.set(url.href, Math.max(score, scored.get(url.href) ?? 0));
  }
  return [...scored].sort((a, b) => b[1] - a[1]).slice(0, max).map(([u]) => u);
}

export const isSkippedHost = (url: string) => {
  try {
    return SKIP_HOSTS.test(new URL(url).hostname);
  } catch {
    return true;
  }
};

/** Minimal robots.txt check for the "*" group and our own user-agent token. */
export function robotsAllows(robotsTxt: string, path: string, agentToken = "macromapbot"): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if (current) {
      if (val || key === "allow") current.rules.push({ allow: key === "allow", path: val });
      lastWasAgent = false;
    }
  }
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && agentToken.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    if (!r.path) continue;
    const re = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

/** Does this page plausibly contain a menu? (cheap gate before spending AI calls) */
export function looksLikeMenu(pageText: string): boolean {
  const prices = (pageText.match(/(?:kr\.?\s*\d{2,4}|\d{2,4}\s*(?:kr|,-|nok)|\d{2,4}[.,]00)/gi) ?? []).length;
  const food = (pageText.match(/\b(kylling|chicken|laks|salmon|biff|beef|pizza|burger|salat|salad|suppe|soup|ris|rice|pasta|sushi|kebab|taco|curry|wrap|fries|pommes|ost|cheese|vegetar|vegan|dessert|nudler|noodles|lam|lamb|torsk|fisk|fish|reker|shrimp)\b/gi) ?? []).length;
  return prices >= 3 && food >= 3;
}

const aiReplySchema = z.object({
  dishes: z
    .array(z.object({ name: z.string().min(2).max(120), description: z.string().max(500).nullable().optional(), price_nok: z.number().nullable().optional() }))
    .max(100),
});

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Validates AI output against the page it was given: dishes whose name does not
 * appear in the page text are dropped, so the model can't invent menu items.
 */
export function validateAiDishes(raw: unknown, pageText: string): ParsedDish[] {
  const parsed = aiReplySchema.safeParse(raw);
  if (!parsed.success) return [];
  const page = norm(pageText);
  return dedupeDishes(
    parsed.data.dishes
      .filter((d) => page.includes(norm(d.name)))
      .map((d) => ({ name: d.name.trim(), description: d.description?.trim() || null, priceNok: price(d.price_nok) })),
  );
}

export const AI_EXTRACT_PROMPT = `You extract a restaurant's menu from the text of its website.
Return JSON only: {"dishes":[{"name": string, "description": string|null, "price_nok": number|null}]}
Rules:
- Only items that appear in the text. Copy names exactly as written (keep Norwegian). Never invent anything.
- Food and main drinks only. Skip opening hours, addresses, allergen codes, sides/sauces/extras under 30 kr, and wine lists.
- description: the ingredients/description text right next to the dish, if any.
- price_nok: the dish's price in NOK as a number (e.g. "kr 189,-" → 189), or null.
- If the text contains no menu, return {"dishes": []}.`;
