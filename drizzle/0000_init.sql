CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"menu_item_id" uuid,
	"restaurant_id" text,
	"name" text NOT NULL,
	"restaurant_name" text,
	"selections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"portion" real DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"kcal" real NOT NULL,
	"kcal_min" real NOT NULL,
	"kcal_max" real NOT NULL,
	"protein" real NOT NULL,
	"protein_min" real NOT NULL,
	"protein_max" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"fiber" real
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"selections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"food_group" text NOT NULL,
	"source_db" text NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"per100g" jsonb NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"price_nok" real,
	"source_type" text NOT NULL,
	"source_url" text,
	"stated_diet" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_checked" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"input_hash" text NOT NULL,
	"basis" jsonb NOT NULL,
	"kcal_min" real NOT NULL,
	"kcal_likely" real NOT NULL,
	"kcal_max" real NOT NULL,
	"protein_min" real NOT NULL,
	"protein_likely" real NOT NULL,
	"protein_max" real NOT NULL,
	"carbs_likely" real NOT NULL,
	"fat_likely" real NOT NULL,
	"fiber_likely" real,
	"serving_g_likely" real,
	"main_uncertainty" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"goal_type" text DEFAULT 'maintain' NOT NULL,
	"kcal_target" real DEFAULT 2200 NOT NULL,
	"protein_g" real DEFAULT 130 NOT NULL,
	"carbs_g" real DEFAULT 240 NOT NULL,
	"fat_g" real DEFAULT 75 NOT NULL,
	"weight_kg" real,
	"show_demo" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nutrition_record_id" uuid NOT NULL,
	"food_key" text NOT NULL,
	"role" text NOT NULL,
	"grams_min" real NOT NULL,
	"grams_likely" real NOT NULL,
	"grams_max" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"address" text,
	"city" text,
	"country_code" text,
	"cuisines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amenity" text,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_restaurants" (
	"user_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_records" ADD CONSTRAINT "nutrition_records_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_nutrition_record_id_nutrition_records_id_fk" FOREIGN KEY ("nutrition_record_id") REFERENCES "public"."nutrition_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_food_key_foods_key_fk" FOREIGN KEY ("food_key") REFERENCES "public"."foods"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_restaurants" ADD CONSTRAINT "saved_restaurants_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diary_user_day_idx" ON "diary_entries" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_item_idx" ON "favorites" USING btree ("user_id","menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "nutrition_records_item_idx" ON "nutrition_records" USING btree ("menu_item_id","created_at");--> statement-breakpoint
CREATE INDEX "restaurants_lat_lng_idx" ON "restaurants" USING btree ("lat","lng");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_restaurants_pk" ON "saved_restaurants" USING btree ("user_id","restaurant_id");