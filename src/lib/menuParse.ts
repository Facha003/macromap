export interface ParsedDish {
  name: string;
  description: string | null;
  priceNok: number | null;
}

// "159", "159,00", "kr 159", "159 kr", "159,-", "NOK 159.00"
const PRICE = /(?:^|\s)(?:kr\.?|nok)?\s*(\d{1,4})(?:[.,](\d{1,2}))?\s*(?:kr\.?|,-|nok)?\s*$/i;
const PRICE_ONLY = /^(?:fra\s+|from\s+)?(?:kr\.?|nok)?\s*\d{1,4}(?:[.,]\d{1,2})?\s*(?:kr\.?|,-|nok)?$/i;
const NOISE = /^(popul|most ordered|mest bestilt|populære|anbefalt|recommended|add|legg til|\+|−|-|sold out|utsolgt|new|nyhet|ny!?|tilbud|offer|\d+\s?%|allergen|contains|inneholder|vegan$|vegetar$|spicy$|sterk$|\(?\d+\)?$|kcal|see more|vis mer|read more|les mer|order|bestill|menu|meny)/i;

// A comma between digits ("0,5 l") is a decimal, not a list separator.
const hasListComma = (l: string) => /,(?!\d)/.test(l);
const isDescription = (l: string) => l.length > 45 || hasListComma(l) || /^[a-zæøå(]/.test(l) || /\b(med|with|and|og|served|servert)\b/i.test(l);

function priceOf(l: string): number | null {
  const m = l.match(PRICE);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0);
}

/**
 * Extracts dishes from menu text a user copied (e.g. from Wolt, foodora or the
 * restaurant's own site). Heuristic: a price closes an item; the line before it
 * is the description if it reads like one, and the line before that the name.
 * Without prices, short lines become dishes and longer lines their descriptions.
 */
export function parseMenuText(text: string, limit = 80): ParsedDish[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1 && !NOISE.test(l));
  const dishes: ParsedDish[] = [];
  const hasPrices = lines.some((l) => PRICE_ONLY.test(l) || (priceOf(l) !== null && /kr|,-|nok/i.test(l)));

  if (hasPrices) {
    let buffer: string[] = [];
    for (const line of lines) {
      if (PRICE_ONLY.test(line)) {
        pushFromBuffer(buffer, priceOf(line));
        buffer = [];
      } else if (/(kr|,-|nok)\s*$/i.test(line) && priceOf(line) !== null && line.replace(PRICE, "").trim().length > 1) {
        // "Chicken wrap 159 kr" — name and price on one line.
        buffer.push(line.replace(PRICE, "").replace(/[.\-–·\s]+$/, "").trim());
        pushFromBuffer(buffer, priceOf(line));
        buffer = [];
      } else {
        buffer.push(line);
      }
    }
  } else {
    for (const line of lines) {
      const last = dishes[dishes.length - 1];
      if (last && !last.description && isDescription(line)) last.description = line.slice(0, 500);
      else if (line.length <= 60) dishes.push({ name: line, description: null, priceNok: null });
    }
  }

  function pushFromBuffer(buf: string[], price: number | null) {
    if (!buf.length) return;
    let name = buf[buf.length - 1];
    let description: string | null = null;
    const prev = buf[buf.length - 2];
    // Dish names are short and comma-free ("Kebab plate with rice"); descriptions aren't.
    if (prev && isDescription(name) && !hasListComma(prev) && prev.length <= 60 && !/^[a-zæøå(]/.test(prev)) {
      description = name;
      name = prev;
    }
    if (name.length > 80) return;
    dishes.push({ name: name.slice(0, 120), description: description?.slice(0, 500) ?? null, priceNok: price });
  }

  const seen = new Set<string>();
  return dishes.filter((d) => {
    const k = d.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, limit);
}
