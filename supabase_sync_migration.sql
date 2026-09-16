-- ====================================================================
-- SAGAR RATNA RESTAURANT CONTROL HUB - DATABASE SCHEMA SYNCHRONIZATION
-- Location: /supabase_sync_migration.sql
-- Description: Syncs orders table columns with codebase without data loss.
-- ====================================================================

-- 1. ADD MISSING COLUMNS TO ORDERS TABLE (INCLUDING ADDRESS)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'takeaway';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gst NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packaging_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applied_coupon TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kot_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. BACKFILL DATA FOR ORDER_TYPE FROM EXISTING BOOKINGS
-- Ensure non-null values for order_type
UPDATE public.orders SET order_type = 'takeaway' WHERE order_type IS NULL;

-- 3. CREATE INDEXES FOR FAST REPORTING FILTERS AND SEARCH
CREATE INDEX IF NOT EXISTS orders_order_type_idx ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS orders_order_status_idx ON public.orders(order_status);

-- 4. RE-DECLARE PUBLIC RLS POLICIES FOR ASSURED SAFETY
-- (PostgreSQL automatically applies existing policies to newly added columns, but this enforces synchronization)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read orders" ON public.orders;
CREATE POLICY "Allow public read orders" ON public.orders FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public insert orders" ON public.orders;
CREATE POLICY "Allow public insert orders" ON public.orders FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update orders" ON public.orders;
CREATE POLICY "Allow public update orders" ON public.orders FOR UPDATE TO public USING (true);

-- 5. RELOAD POSTGREST SCHEMA CACHE
-- This is critical to inform PostgREST of the newly added columns and eliminate 'schema cache' mismatch errors
NOTIFY pgrst, 'reload schema';
