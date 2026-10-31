import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = join(process.cwd(), "drizzle");

/**
 * Local mode (no DATABASE_URL): embedded Postgres (PGlite) persisted in .data/pglite,
 * migrated and seeded automatically on first use.
 * Hosted mode: DATABASE_URL points at Supabase/any Postgres; run `npm run db:migrate`.
 */
async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { max: 5, prepare: false });
    return drizzle(client, { schema }) as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR || join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db as unknown as Db);
  return db as unknown as Db;
}

const globalForDb = globalThis as unknown as { __macromapDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__macromapDb) {
    globalForDb.__macromapDb = connect().catch((e) => {
      globalForDb.__macromapDb = undefined;
      throw e;
    });
  }
  return globalForDb.__macromapDb;
}

export { schema };
