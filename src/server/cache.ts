import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { apiCache } from "./db/schema";

/** Read-through cache backed by the api_cache table. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key)).limit(1);
  if (row && Date.now() - row.fetchedAt.getTime() < ttlMs) return row.payload as T;
  const payload = await load();
  await db
    .insert(apiCache)
    .values({ key, payload, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: apiCache.key, set: { payload, fetchedAt: new Date() } });
  return payload;
}

export async function readCache<T>(key: string, ttlMs: number): Promise<T | null> {
  const db = await getDb();
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key)).limit(1);
  return row && Date.now() - row.fetchedAt.getTime() < ttlMs ? (row.payload as T) : null;
}

export async function writeCache(key: string, payload: unknown) {
  const db = await getDb();
  await db
    .insert(apiCache)
    .values({ key, payload, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: apiCache.key, set: { payload, fetchedAt: new Date() } });
}
