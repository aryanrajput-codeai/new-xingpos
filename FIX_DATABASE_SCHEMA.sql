-- ====================================================================
-- SAGAR RATNA RESTAURANT CONTROL HUB - DATABASE REPAIR SCRIPT
-- Copy and run this script in your Supabase SQL Editor to resolve the bigint/string mismatch.
-- ====================================================================

-- 1. CONVERT ID COLUMN TO TEXT TO ALLOW BOTH ALPHANUMERIC STRINGS AND NUMERIC IDS
ALTER TABLE public.menu_items ALTER COLUMN id TYPE TEXT USING id::text;

-- 2. ENSURE ALL OTHER COLUMNS AND ALIASES EXIST
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

-- 3. ENSURE ROW LEVEL SECURITY IS CONFIGURABLE FOR READ & WRITE
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to menu_items" ON public.menu_items;
CREATE POLICY "Allow public read access to menu_items"
    ON public.menu_items FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public write access to menu_items" ON public.menu_items;
CREATE POLICY "Allow public write access to menu_items"
    ON public.menu_items FOR ALL TO public USING (true);

-- 4. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
