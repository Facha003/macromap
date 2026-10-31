import {
  boolean,
  date,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { EstimateBasis } from "@/lib/nutrition/basis";
import type { Selections } from "@/lib/nutrition/customize";
import type { Per100g } from "@/lib/nutrition/types";

export interface RestaurantTags {
  website?: string;
  /** Direct link to the menu, when OpenStreetMap has one (website:menu / menu:url). */
  menuUrl?: string;
  phone?: string;
  openingHours?: string;
  vegetarian?: "yes" | "only" | "no";
  vegan?: "yes" | "only" | "no";
  halal?: "yes" | "only" | "no";
  takeaway?: boolean;
}

export const restaurants = pgTable(
  "restaurants",
  {
    /** "<provider>:<provider id>", e.g. "osm:node/123" or "demo:kebab-grill" */
    id: text("id").primaryKey(),
    provider: text("provider").notNull(), // osm | google | demo | community
    providerId: text("provider_id").notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    address: text("address"),
    city: text("city"),
    countryCode: text("country_code"),
    cuisines: jsonb("cuisines").$type<string[]>().notNull().default([]),
    amenity: text("amenity"),
    tags: jsonb("tags").$type<RestaurantTags>().notNull().default({}),
    isDemo: boolean("is_demo").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("restaurants_lat_lng_idx").on(t.lat, t.lng)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: text("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    priceNok: real("price_nok"),
    /** official = published by the restaurant; community = added by a user; demo = illustrative */
    sourceType: text("source_type").$type<"official" | "community" | "demo">().notNull(),
    sourceUrl: text("source_url"),
    /** Diet flags stated by the restaurant (not inferred). */
    statedDiet: jsonb("stated_diet").$type<{ vegetarian?: boolean; vegan?: boolean; halal?: boolean }>().notNull().default({}),
    lastChecked: timestamp("last_checked", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("menu_items_restaurant_idx").on(t.restaurantId)],
);

/** Food-composition records (see data/foods.snapshot.json for provenance). */
export const foods = pgTable("foods", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  foodGroup: text("food_group").notNull(),
  sourceDb: text("source_db").notNull(),
  sourceId: text("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  per100g: jsonb("per100g").$type<Per100g>().notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
});

/**
 * One row per computed nutrition result. Official data has status "verified";
 * AI/template output has status "estimated" and keeps the full basis so the
 * estimate can be reproduced and audited.
 */
export const nutritionRecords = pgTable(
  "nutrition_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    status: text("status").$type<"verified" | "external" | "estimated">().notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    inputHash: text("input_hash").notNull(),
    basis: jsonb("basis").$type<EstimateBasis>().notNull(),
    kcalMin: real("kcal_min").notNull(),
    kcalLikely: real("kcal_likely").notNull(),
    kcalMax: real("kcal_max").notNull(),
    proteinMin: real("protein_min").notNull(),
    proteinLikely: real("protein_likely").notNull(),
    proteinMax: real("protein_max").notNull(),
    carbsLikely: real("carbs_likely").notNull(),
    fatLikely: real("fat_likely").notNull(),
    fiberLikely: real("fiber_likely"),
    servingGLikely: real("serving_g_likely"),
    mainUncertainty: text("main_uncertainty"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nutrition_records_item_idx").on(t.menuItemId, t.createdAt)],
);

export const recipeComponents = pgTable("recipe_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  nutritionRecordId: uuid("nutrition_record_id").notNull().references(() => nutritionRecords.id, { onDelete: "cascade" }),
  foodKey: text("food_key").notNull().references(() => foods.key),
  role: text("role").notNull(),
  gramsMin: real("grams_min").notNull(),
  gramsLikely: real("grams_likely").notNull(),
  gramsMax: real("grams_max").notNull(),
});

export type GoalType = "cut" | "bulk" | "maintain" | "healthy" | "custom";

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  goalType: text("goal_type").$type<GoalType>().notNull().default("maintain"),
  kcalTarget: real("kcal_target").notNull().default(2200),
  proteinG: real("protein_g").notNull().default(130),
  carbsG: real("carbs_g").notNull().default(240),
  fatG: real("fat_g").notNull().default(75),
  weightKg: real("weight_kg"),
  showDemo: boolean("show_demo").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    day: date("day").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    menuItemId: uuid("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
    restaurantId: text("restaurant_id"),
    name: text("name").notNull(),
    restaurantName: text("restaurant_name"),
    selections: jsonb("selections").$type<Selections>().notNull().default({}),
    portion: real("portion").notNull().default(1),
    status: text("status").notNull(),
    provider: text("provider").notNull(),
    /** Nutrients for portion = 1, snapshotted at log time. */
    kcal: real("kcal").notNull(),
    kcalMin: real("kcal_min").notNull(),
    kcalMax: real("kcal_max").notNull(),
    protein: real("protein").notNull(),
    proteinMin: real("protein_min").notNull(),
    proteinMax: real("protein_max").notNull(),
    carbs: real("carbs").notNull(),
    fat: real("fat").notNull(),
    fiber: real("fiber"),
  },
  (t) => [index("diary_user_day_idx").on(t.userId, t.day)],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
    selections: jsonb("selections").$type<Selections>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favorites_user_item_idx").on(t.userId, t.menuItemId)],
);

export const savedRestaurants = pgTable(
  "saved_restaurants",
  {
    userId: text("user_id").notNull(),
    restaurantId: text("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_restaurants_pk").on(t.userId, t.restaurantId)],
);

/** Caches third-party lookups (Overpass, Nominatim) to respect their usage policies. */
export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});
