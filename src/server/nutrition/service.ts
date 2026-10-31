import "server-only";
import { createHash } from "node:crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { resolveBasis, templateBasis, type EstimateBasis } from "@/lib/nutrition/basis";
import { restaurantKind } from "@/lib/typicalDishes";
import type { OfficialNutrition } from "@/lib/nutrition/types";
import { getDb } from "../db";
import { menuItems, nutritionRecords, recipeComponents, restaurants } from "../db/schema";
import { rateLimit } from "../rateLimit";
import { buildPrompt, interpretationToBasis } from "@/lib/nutrition/llm";
import { getLlmProvider } from "./llm/providers";

/** Bump when the estimation pipeline changes in a way that should invalidate cached estimates. */
const ESTIMATOR_VERSION = "2";

type MenuItemRow = typeof menuItems.$inferSelect;
type RecordRow = typeof nutritionRecords.$inferSelect;

function inputHash(item: Pick<MenuItemRow, "name" | "description">): string {
  return createHash("sha1").update(`${ESTIMATOR_VERSION}|${item.name}|${item.description ?? ""}`).digest("hex");
}

/** Latest record per item, preferring verified (official) data over estimates. */
export async function latestRecords(itemIds: string[]): Promise<Map<string, RecordRow>> {
  if (!itemIds.length) return new Map();
  const db = await getDb();
  const rows = await db
    .selectDistinctOn([nutritionRecords.menuItemId])
    .from(nutritionRecords)
    .where(inArray(nutritionRecords.menuItemId, itemIds))
    .orderBy(nutritionRecords.menuItemId, sql`(${nutritionRecords.status} = 'verified') desc`, desc(nutritionRecords.createdAt));
  return new Map(rows.map((r) => [r.menuItemId, r]));
}

async function storeRecord(item: MenuItemRow, basis: EstimateBasis, model: string | null = null): Promise<RecordRow> {
  const db = await getDb();
  const { estimate } = resolveBasis(basis);
  const provider = basis.kind === "official" ? "official" : basis.kind === "unavailable" ? "none" : estimate?.provider ?? basis.provider;
  const [rec] = await db
    .insert(nutritionRecords)
    .values({
      menuItemId: item.id,
      status: estimate?.status ?? "estimated",
      provider,
      model,
      inputHash: inputHash(item),
      basis,
      kcalMin: estimate?.values.kcal.min ?? 0,
      kcalLikely: estimate?.values.kcal.likely ?? 0,
      kcalMax: estimate?.values.kcal.max ?? 0,
      proteinMin: estimate?.values.protein.min ?? 0,
      proteinLikely: estimate?.values.protein.likely ?? 0,
      proteinMax: estimate?.values.protein.max ?? 0,
      carbsLikely: estimate?.values.carbs.likely ?? 0,
      fatLikely: estimate?.values.fat.likely ?? 0,
      fiberLikely: estimate?.values.fiber?.likely ?? null,
      servingGLikely: estimate?.servingG?.likely ?? null,
      mainUncertainty: estimate?.mainUncertainty ?? null,
    })
    .returning();
  if (estimate?.components.length) {
    await db.insert(recipeComponents).values(
      estimate.components.map((c) => ({
        nutritionRecordId: rec.id,
        foodKey: c.foodKey,
        role: c.role,
        gramsMin: c.grams.min,
        gramsLikely: c.grams.likely,
        gramsMax: c.grams.max,
      })),
    );
  }
  return rec;
}

/** Makes sure every item has at least a template estimate (cheap, deterministic). */
export async function ensureEstimates(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const db = await getDb();
  const recs = await latestRecords(itemIds);
  // Missing, or estimated from older menu text / an older estimator version.
  const candidates = itemIds.filter((id) => recs.get(id)?.status !== "verified");
  if (!candidates.length) return;
  const items = await db.select().from(menuItems).where(inArray(menuItems.id, candidates));
  for (const item of items) {
    const rec = recs.get(item.id);
    if (!rec || rec.inputHash !== inputHash(item)) await storeRecord(item, templateBasis(item.name, item.description ?? ""));
  }
}

export interface ItemBasis {
  basis: EstimateBasis;
  record: RecordRow;
  aiNote: string | null;
}

/**
 * Returns the best available basis for one item. Priority:
 *   1. verified (official) record
 *   2. cached AI estimate for the current menu text
 *   3. fresh AI estimate (if a provider is configured and allowAi)
 *   4. template estimate
 */
export async function getItemBasis(itemId: string, opts: { allowAi: boolean }): Promise<ItemBasis | null> {
  const db = await getDb();
  const [row] = await db
    .select({ item: menuItems, restaurant: restaurants })
    .from(menuItems)
    .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
    .where(eq(menuItems.id, itemId))
    .limit(1);
  if (!row) return null;
  const { item, restaurant } = row;
  const rec = (await latestRecords([item.id])).get(item.id);
  const hash = inputHash(item);

  if (rec?.status === "verified") return { basis: rec.basis, record: rec, aiNote: null };
  const llm = getLlmProvider();
  const fresh = rec && rec.inputHash === hash;
  // "ai-fallback" marks a template that was kept after the AI already declined this text.
  const upgradable = rec?.provider === "template" || rec?.provider === "none";
  if (fresh && (!upgradable || rec.model === "ai-fallback" || !opts.allowAi || !llm)) {
    return { basis: rec.basis, record: rec, aiNote: llm ? null : "AI estimation is not configured — showing a template estimate." };
  }

  const template = templateBasis(item.name, item.description ?? "", "template", restaurantKind(restaurant));
  if (opts.allowAi && llm) {
    if (!rateLimit("llm-global", Number(process.env.AI_REQUESTS_PER_MINUTE || 10), 5)) {
      const r = fresh ? rec : await storeRecord(item, template);
      return { basis: r.basis, record: r, aiNote: "AI is busy (free-tier rate limit) — showing a template estimate. Try again in a minute." };
    }
    try {
      const { system, user } = buildPrompt({ name: item.name, description: item.description, cuisines: restaurant.cuisines, restaurantName: restaurant.isDemo ? undefined : restaurant.name });
      const ai = interpretationToBasis(await llm.complete(system, user), llm.id);
      // Keep a template match if the model declines but our template recognises the dish.
      const chosen = !ai || (ai.kind === "unavailable" && template.kind === "archetype") ? template : ai;
      const r = await storeRecord(item, chosen, chosen === ai ? llm.model : "ai-fallback");
      return { basis: r.basis, record: r, aiNote: chosen === ai ? null : "The AI response couldn't be used — showing a template estimate." };
    } catch (e) {
      console.error("[nutrition] LLM failed:", (e as Error).message);
      const r = fresh ? rec : await storeRecord(item, template);
      return { basis: r.basis, record: r, aiNote: "AI estimation failed — showing a template estimate." };
    }
  }
  const r = fresh ? rec : await storeRecord(item, template);
  return { basis: r.basis, record: r, aiNote: llm ? null : "AI estimation is not configured — showing a template estimate." };
}

/** Admin/import path for nutrition published by the restaurant itself. */
export async function importOfficial(itemId: string, official: OfficialNutrition) {
  const db = await getDb();
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, itemId)).limit(1);
  if (!item) throw new Error("Menu item not found");
  await db.update(menuItems).set({ sourceType: "official", sourceUrl: official.sourceUrl, lastChecked: new Date(official.checkedAt) }).where(eq(menuItems.id, itemId));
  return storeRecord(item, { kind: "official", official });
}
