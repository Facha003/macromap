/**
 * Reads menus from restaurants' OWN websites (listed on OpenStreetMap) and
 * writes public/menus/<id>.json + public/menus/index.json for the static site.
 *
 *   npm run menus:crawl
 *   MENU_CRAWL_LIMIT=40 npm run menus:crawl
 *
 * Extraction, in order: schema.org JSON-LD → GitHub Models AI (in GitHub
 * Actions, via GITHUB_TOKEN with models:read) → rule-based parser.
 * Politeness: robots.txt, identifying User-Agent, ≤1 request/s per host,
 * ≤4 pages per site, 15 s timeouts, 2 MB cap. Never fetches delivery platforms.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { parseMenuText } from "../src/lib/menuParse";
import type { PlaceTileRow } from "../src/lib/placeTiles";
import {
  AI_EXTRACT_PROMPT,
  dedupeDishes,
  extractJsonLdMenu,
  htmlToText,
  isSkippedHost,
  looksLikeMenu,
  menuFileName,
  menuLinks,
  robotsAllows,
  validateAiDishes,
  type MenuIndex,
  type MenuMethod,
  type WebsiteMenu,
} from "../src/lib/websiteMenu";
import type { ParsedDish } from "../src/lib/menuParse";

const PLACES = join(process.cwd(), "public", "places");
const OUT = join(process.cwd(), "public", "menus");
const UA = "MacroMapBot/0.1 (+https://github.com/Facha003/macromap; reads public menus to estimate nutrition)";
const LIMIT = Number(process.env.MENU_CRAWL_LIMIT || 600);
const TIME_BUDGET_MS = Number(process.env.MENU_CRAWL_MINUTES || 25) * 60_000;
const RECHECK_MS = 14 * 24 * 3600_000;
const RECHECK_ERROR_MS = 3 * 24 * 3600_000;
const CONCURRENCY = 6;
const MAX_PAGES = 7;
const COMMON_MENU_PATHS = ["/meny", "/menu", "/menyer", "/mat", "/meny/", "/menu/", "/lunsj", "/middag", "/spisekart", "/en/menu"];
// Statuses to re-check now even if checked recently (e.g. MENU_RECHECK=none,no-text after crawler improvements).
const RECHECK_NOW = new Set((process.env.MENU_RECHECK || "").split(",").map((x) => x.trim()).filter(Boolean));
const MAX_BYTES = 2_000_000;
const OSLO = { minLat: 59.8, maxLat: 60.05, minLng: 10.55, maxLng: 10.95 };

// ── GitHub Models (free in Actions) ───────────────────────────────────────
const AI_TOKEN = process.env.GITHUB_TOKEN || "";
const AI_MODEL = process.env.MENU_AI_MODEL || "openai/gpt-4o-mini";
let aiBudget = Number(process.env.MENU_AI_BUDGET || 120);
let aiAvailable = Boolean(AI_TOKEN);
const aiStats = { calls: 0, ok: 0, httpErrors: {} as Record<string, number>, emptyAfterValidation: 0, badJson: 0, firstError: "" };

async function aiExtract(pageText: string): Promise<ParsedDish[] | null> {
  if (!aiAvailable || aiBudget <= 0) return null;
  aiBudget--;
  aiStats.calls++;
  try {
    const res = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${AI_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_EXTRACT_PROMPT },
          { role: "user", content: pageText.slice(0, 24_000) },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.text();
    if (!res.ok) {
      aiStats.httpErrors[res.status] = (aiStats.httpErrors[res.status] ?? 0) + 1;
      aiStats.firstError ||= `HTTP ${res.status}: ${body.slice(0, 300)}`;
      if (res.status === 429 || res.status === 401 || res.status === 403) {
        console.warn(`  GitHub Models unavailable (HTTP ${res.status}: ${body.slice(0, 200)}) — continuing without AI`);
        aiAvailable = false;
      }
      return null;
    }
    if (!body.trimStart().startsWith("{")) {
      // The endpoint answered, but not with JSON (seen: a bare "OK") — stop spending time on it this run.
      console.warn(`  GitHub Models returned a non-JSON reply (${body.slice(0, 40).trim()}) — continuing without AI`);
      aiStats.badJson++;
      aiAvailable = false;
      return null;
    }
    let content = "";
    try {
      content = JSON.parse(body)?.choices?.[0]?.message?.content ?? "";
      const dishes = validateAiDishes(JSON.parse(content), pageText);
      if (dishes.length) aiStats.ok++;
      else aiStats.emptyAfterValidation++;
      return dishes;
    } catch {
      aiStats.badJson++;
      aiStats.firstError ||= `Unreadable reply: ${(content || body).slice(0, 300)}`;
      return null;
    }
  } catch (e) {
    aiStats.firstError ||= `Request failed: ${(e as Error).message}`;
    return null;
  }
}

// ── polite fetching ───────────────────────────────────────────────────────
const lastHit = new Map<string, number>();
const robotsCache = new Map<string, Promise<string>>();

async function politeFetch(url: string, retry = true): Promise<Response | null> {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  let res: Response | null = null;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "nb,no,en" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  } catch {
    res = null;
  }
  // One retry for network errors and server hiccups (never for 4xx — that's the site's answer).
  if (retry && (!res || res.status >= 500)) {
    await new Promise((r) => setTimeout(r, 3000));
    return politeFetch(url, false);
  }
  return res;
}

async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  let robots = robotsCache.get(u.origin);
  if (!robots) {
    robots = politeFetch(`${u.origin}/robots.txt`).then(async (r) => (r && r.ok ? (await r.text()).slice(0, 100_000) : ""));
    robotsCache.set(u.origin, robots);
  }
  return robotsAllows(await robots, u.pathname);
}

// ── optional JavaScript rendering (MENU_RENDER=1) for sites that build pages in the browser ──
type Browser = import("playwright").Browser;
let browserPromise: Promise<Browser | null> | null = null;
function browser(): Promise<Browser | null> {
  browserPromise ??= process.env.MENU_RENDER === "1"
    ? import("playwright").then((pw) => pw.chromium.launch()).catch((e) => {
        console.warn(`  JS rendering unavailable: ${(e as Error).message.slice(0, 120)}`);
        return null;
      })
    : Promise.resolve(null);
  return browserPromise;
}

/** Loads a page in headless Chromium (no images/fonts/media) and returns the rendered HTML. */
async function renderPage(url: string): Promise<{ url: string; html: string; text: string } | null> {
  const b = await browser();
  if (!b) return null;
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  const ctx = await b.newContext({ userAgent: UA, locale: "nb-NO" });
  try {
    const page = await ctx.newPage();
    await page.route("**/*", (route) => (["image", "font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue()));
    await page.goto(url, { waitUntil: "networkidle", timeout: 25_000 }).catch(() => page.waitForLoadState("domcontentloaded"));
    const html = await page.content();
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    return { url: page.url(), html, text };
  } catch {
    return null;
  } finally {
    await ctx.close();
  }
}

async function readBody(res: Response): Promise<{ kind: "html" | "pdf"; html?: string; text: string } | null> {
  const type = res.headers.get("content-type") ?? "";
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return null;
  if (type.includes("pdf") || res.url.toLowerCase().endsWith(".pdf")) {
    try {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      return { kind: "pdf", text: text.replace(/[ \t]+\n/g, "\n") };
    } catch {
      return null;
    }
  }
  if (!type.includes("html")) return null;
  const html = new TextDecoder().decode(buf);
  return { kind: "html", html, text: htmlToText(html) };
}

// ── per restaurant ────────────────────────────────────────────────────────
interface Target { id: string; name: string; url: string; inOslo: boolean }

async function crawl(t: Target): Promise<{ status: MenuIndex[string]["status"]; menu?: WebsiteMenu }> {
  const first = await crawlOnce(t, false);
  // Many restaurant sites build their content with JavaScript: render them when the plain fetch found nothing.
  if ((first.status === "no-text" || first.status === "none") && (await browser())) {
    const rendered = await crawlOnce(t, true);
    if (rendered.status === "found") {
      rendersFound++;
      return rendered;
    }
  }
  return first;
}
let rendersFound = 0;

async function crawlOnce(t: Target, render: boolean): Promise<{ status: MenuIndex[string]["status"]; menu?: WebsiteMenu }> {
  const start = t.url.startsWith("http") ? t.url : `https://${t.url}`;
  if (isSkippedHost(start)) return { status: "none" };
  if (!(await allowed(start))) return { status: "blocked" };
  if (render) return crawlRendered(t, start);
  let res = await politeFetch(start);
  // OSM often has outdated deep links; fall back to the site's front page.
  if (res && (res.status === 404 || res.status === 410) && new URL(start).pathname.length > 1) {
    const root = new URL(start).origin + "/";
    if (await allowed(root)) res = await politeFetch(root);
  }
  if (!res || !res.ok) return { status: "error" };
  const home = await readBody(res);
  if (!home) return { status: "error" };

  // Candidate pages: the start page plus up to 3 same-site menu links.
  const pages: { url: string; html?: string; text: string }[] = [{ url: res.url, html: home.html, text: home.text }];
  const seen = new Set([res.url]);
  const visit = async (link: string) => {
    if (seen.has(link) || pages.length >= MAX_PAGES || isSkippedHost(link) || !(await allowed(link))) return null;
    seen.add(link);
    const r = await politeFetch(link);
    const body = r && r.ok ? await readBody(r) : null;
    if (!body) return null;
    const page = { url: r!.url, html: body.html, text: body.text };
    pages.push(page);
    return page;
  };
  if (home.html) for (const link of menuLinks(home.html, res.url)) await visit(link);
  // A menu "hub" page often only links to the real menus (lunsj / middag / takeaway): go one level deeper.
  for (const p of pages.slice(1)) {
    if (p.html && !looksLikeMenu(p.text)) for (const link of menuLinks(p.html, p.url, 2)) await visit(link);
  }
  // No menu link at all? Try the addresses restaurant sites usually use.
  if (!pages.some((p) => looksLikeMenu(p.text))) {
    const origin = new URL(res.url).origin;
    for (const path of COMMON_MENU_PATHS) {
      if (pages.length >= MAX_PAGES || pages.some((p) => looksLikeMenu(p.text))) break;
      await visit(origin + path);
    }
  }

  const found = (dishes: ParsedDish[], method: MenuMethod, url: string) => ({
    status: "found" as const,
    menu: { restaurantId: t.id, sourceUrl: url, checkedAt: new Date().toISOString(), method, dishes: dedupeDishes(dishes) },
  });

  // 1. schema.org JSON-LD
  for (const p of pages) {
    const d = p.html ? extractJsonLdMenu(p.html) : [];
    if (d.length >= 3) return found(d, "jsonld", p.url);
  }
  // Menu pages first (they're the links we followed), then the homepage.
  const candidates = [...pages.slice(1), pages[0]].filter((p) => looksLikeMenu(p.text));
  if (!candidates.length) return { status: pages.some((p) => p.text.length > 200) ? "none" : "no-text" };
  // 2. GitHub Models AI
  for (const p of candidates) {
    const d = await aiExtract(p.text);
    if (d && d.length >= 3) return found(d, "ai", p.url);
  }
  // 3. Rule-based parser, strict quality gate
  for (const p of candidates) {
    const raw = parseMenuText(p.text, 200).filter((x) => x.priceNok != null);
    const clean = dedupeDishes(raw);
    // Accept only if most of what the parser found looks like real dishes.
    if (clean.length >= 5 && clean.length >= raw.length * 0.6) return found(clean, "parser", p.url);
  }
  return { status: "none" };
}

/** Same strategy as crawlOnce, but every page is loaded in headless Chromium. */
async function crawlRendered(t: Target, start: string): Promise<{ status: MenuIndex[string]["status"]; menu?: WebsiteMenu }> {
  const home = await renderPage(start);
  if (!home) return { status: "error" };
  const pages = [home];
  const seen = new Set([home.url]);
  const visit = async (link: string) => {
    if (seen.has(link) || pages.length >= 5 || isSkippedHost(link) || !(await allowed(link))) return;
    seen.add(link);
    const p = await renderPage(link);
    if (p) pages.push(p);
  };
  for (const link of menuLinks(home.html, home.url)) await visit(link);
  for (const p of pages.slice(1)) if (!looksLikeMenu(p.text)) for (const link of menuLinks(p.html, p.url, 2)) await visit(link);
  const found = (dishes: ParsedDish[], method: MenuMethod, url: string) => ({
    status: "found" as const,
    menu: { restaurantId: t.id, sourceUrl: url, checkedAt: new Date().toISOString(), method, dishes: dedupeDishes(dishes) },
  });
  for (const p of pages) {
    const d = extractJsonLdMenu(p.html);
    if (d.length >= 3) return found(d, "jsonld", p.url);
  }
  const candidates = [...pages.slice(1), pages[0]].filter((p) => looksLikeMenu(p.text));
  for (const p of candidates) {
    const d = await aiExtract(p.text);
    if (d && d.length >= 3) return found(d, "ai", p.url);
  }
  for (const p of candidates) {
    const raw = parseMenuText(p.text, 200).filter((x) => x.priceNok != null);
    const clean = dedupeDishes(raw);
    if (clean.length >= 5 && clean.length >= raw.length * 0.6) return found(clean, "parser", p.url);
  }
  return { status: candidates.length ? "none" : "no-text" };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(join(PLACES, "index.json"))) throw new Error("No places snapshot — run npm run places:build first");
  mkdirSync(OUT, { recursive: true });
  const indexPath = join(OUT, "index.json");
  const index: MenuIndex = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};

  const targets: Target[] = [];
  for (const f of readdirSync(PLACES)) {
    if (!/^-?\d+_-?\d+\.json$/.test(f)) continue;
    for (const [providerId, name, lat, lng, , , , tags] of JSON.parse(readFileSync(join(PLACES, f), "utf8")) as PlaceTileRow[]) {
      const url = tags.menuUrl || tags.website;
      if (!url) continue;
      targets.push({ id: `osm:${providerId}`, name, url, inOslo: lat > OSLO.minLat && lat < OSLO.maxLat && lng > OSLO.minLng && lng < OSLO.maxLng });
    }
  }
  const now = Date.now();
  const due = targets
    .filter((t) => !index[t.id] || RECHECK_NOW.has(index[t.id].status) || now - Date.parse(index[t.id].checkedAt) > (index[t.id].status === "error" ? RECHECK_ERROR_MS : RECHECK_MS))
    .sort((a, b) => Number(b.inOslo) - Number(a.inOslo) || Number(Boolean(index[a.id])) - Number(Boolean(index[b.id])) || (index[a.id]?.checkedAt ?? "").localeCompare(index[b.id]?.checkedAt ?? ""))
    .slice(0, LIMIT);
  console.log(`${targets.length} restaurants have a website; ${due.length} due this run. GitHub Models: ${aiAvailable ? `on (${AI_MODEL}, budget ${aiBudget})` : "off (no GITHUB_TOKEN)"}`);

  const counts: Record<string, number> = {};
  const deadline = now + TIME_BUDGET_MS;
  let next = 0;
  const worker = async () => {
    while (next < due.length && Date.now() < deadline) {
      const t = due[next++];
      let result: Awaited<ReturnType<typeof crawl>>;
      try {
        result = await crawl(t);
      } catch {
        result = { status: "error" };
      }
      const key = result.menu ? `found:${result.menu.method}` : result.status;
      counts[key] = (counts[key] ?? 0) + 1;
      index[t.id] = { checkedAt: new Date().toISOString(), status: result.status, dishes: result.menu?.dishes.length ?? 0, sourceUrl: result.menu?.sourceUrl ?? null, method: result.menu?.method };
      if (result.menu) {
        writeFileSync(join(OUT, `${menuFileName(t.id)}.json`), JSON.stringify(result.menu));
        console.log(`  ✓ ${t.name}: ${result.menu.dishes.length} dishes via ${result.menu.method} (${result.menu.sourceUrl})`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(indexPath, JSON.stringify(index));
  const totalFound = Object.values(index).filter((e) => e.status === "found").length;
  console.log(`This run: ${JSON.stringify(counts)}. Menus available in total: ${totalFound}.`);
  if (AI_TOKEN) console.log(`GitHub Models: ${JSON.stringify(aiStats)}`);
  if (process.env.MENU_RENDER === "1") console.log(`Menus found only after JavaScript rendering: ${rendersFound}`);
  await (await browser())?.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
