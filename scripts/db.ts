/**
 * Database CLI.
 *   npm run db:migrate   — apply migrations (DATABASE_URL, or local PGlite)
 *   npm run db:seed      — upsert food-composition data and demo restaurants
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../src/server/db/index";
import * as schema from "../src/server/db/schema";
import { seedDemo, seedFoods } from "../src/server/db/seed";

async function open(): Promise<{ db: Db; migrate: () => Promise<void>; close: () => Promise<void> }> {
  const migrationsFolder = join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
    const db = drizzle(client, { schema });
    return { db: db as unknown as Db, migrate: () => migrate(db, { migrationsFolder }), close: () => client.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR || join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  return { db: db as unknown as Db, migrate: () => migrate(db, { migrationsFolder }), close: () => client.close() };
}

async function main() {
  const cmd = process.argv[2];
  const { db, migrate, close } = await open();
  try {
    await migrate();
    console.log("Migrations applied.");
    if (cmd === "seed") {
      await seedFoods(db);
      if (process.argv.includes("--no-demo")) console.log("Skipping demo restaurants.");
      else await seedDemo(db);
      console.log("Seeded foods" + (process.argv.includes("--no-demo") ? "." : " and demo restaurants."));
    }
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
