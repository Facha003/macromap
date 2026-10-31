-- Row Level Security for Supabase.
-- Apply AFTER the Drizzle migrations (npm run db:migrate) in the Supabase SQL editor.
--
-- The Next.js server connects with the database connection string (a privileged role)
-- and always scopes queries by user id itself. These policies protect the tables if
-- you later expose them through Supabase's client APIs (PostgREST / supabase-js).
-- Signed-in users have user_id = auth.uid()::text.

alter table restaurants         enable row level security;
alter table menu_items          enable row level security;
alter table foods               enable row level security;
alter table nutrition_records   enable row level security;
alter table recipe_components   enable row level security;
alter table profiles            enable row level security;
alter table diary_entries       enable row level security;
alter table favorites           enable row level security;
alter table saved_restaurants   enable row level security;
alter table api_cache           enable row level security;

-- Public reference data: readable by anyone, writable only by the server.
create policy "public read restaurants"       on restaurants       for select using (true);
create policy "public read menu items"        on menu_items        for select using (true);
create policy "public read foods"             on foods             for select using (true);
create policy "public read nutrition"         on nutrition_records for select using (true);
create policy "public read recipe components" on recipe_components for select using (true);

-- Personal data: each user sees and changes only their own rows.
create policy "own profile"  on profiles          for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy "own diary"    on diary_entries     for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy "own favorites" on favorites        for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy "own saved"    on saved_restaurants for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- api_cache: no policies → not reachable through the client APIs at all.
