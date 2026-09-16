-- ====================================================================
-- XINGS KITCHEN - ORDER SOURCE MIGRATION
-- Location: /supabase_order_source_migration.sql
-- Description: Adds order_source column to public.orders table safely
-- ====================================================================

-- 1. ADD order_source COLUMN TO ORDERS TABLE
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_source TEXT;

-- 2. CREATE INDEX FOR FAST FILTERING BY SOURCE CHANNEL
CREATE INDEX IF NOT EXISTS orders_order_source_idx ON public.orders(order_source);

-- 3. CONSERVATIVE BACKFILL FOR EXISTING HISTORICAL ORDERS
-- POS orders: where payment_method contains POS or billed_by is a staff member
UPDATE public.orders
SET order_source = 'POS'
WHERE order_source IS NULL 
  AND (
    payment_method ILIKE '%POS%'
  );

-- QR Menu orders: where payment is Cash on Delivery, tableside QR, or pending New Order
UPDATE public.orders
SET order_source = 'QR_MENU'
WHERE order_source IS NULL
  AND (
    payment_method ILIKE '%Cash on Delivery%' 
    OR order_status = 'New Order'
  );

-- Default any remaining historical orders to QR_MENU for backwards safety
UPDATE public.orders
SET order_source = 'QR_MENU'
WHERE order_source IS NULL;

-- 4. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
