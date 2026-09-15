-- ====================================================================
-- SAGAR RATNA RESTAURANT CONTROL HUB - MENU ITEMS SCHEMA MIGRATION
-- Location: /supabase_menu_items_migration.sql
-- Description: Synchronizes the menu_items table schema with the frontend.
-- ====================================================================

-- 1. CONVERT THE ID COLUMN TO TEXT TO ALLOW BOTH STRING AND NUMERIC/BIGINT IDS SAFELY
ALTER TABLE public.menu_items ALTER COLUMN id TYPE TEXT USING id::text;

-- 2. ADD MISSING COLUMNS TO MENU_ITEMS TABLE IF NOT EXISTS
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_veg BOOLEAN DEFAULT true;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_chef_special BOOLEAN DEFAULT false;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS spiciness INTEGER DEFAULT 0;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 4.5;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 10;

-- 2. BACKFILL DATA FOR NAME / ITEM_NAME AND IMAGE / IMAGE_URL TO ENSURE DUAL-COMPATIBILITY
UPDATE public.menu_items SET name = item_name WHERE name IS NULL AND item_name IS NOT NULL;
UPDATE public.menu_items SET item_name = name WHERE item_name IS NULL AND name IS NOT NULL;
UPDATE public.menu_items SET image = image_url WHERE image IS NULL AND image_url IS NOT NULL;
UPDATE public.menu_items SET image_url = image WHERE image_url IS NULL AND image IS NOT NULL;

-- 3. ENSURE ROW LEVEL SECURITY IS CONFIGURED FOR READ & WRITE
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow public read menu_items" ON public.menu_items;
CREATE POLICY "Allow public read access to menu_items"
    ON public.menu_items FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public write access to menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow public write menu_items" ON public.menu_items;
CREATE POLICY "Allow public write access to menu_items"
    ON public.menu_items FOR ALL TO public USING (true);

-- 4. RELOAD POSTGREST SCHEMA CACHE TO SOLVE PGRST SCHEMA CACHE ERRORS
NOTIFY pgrst, 'reload schema';
