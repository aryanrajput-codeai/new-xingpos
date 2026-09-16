-- ====================================================================
-- SAGAR RATNA POS / WEBRAJYA - PAYMENT SETTLEMENT & SPLIT BILL MIGRATION
-- ====================================================================

-- 1. PAYMENTS TABLE (Detailed transaction settlement ledger)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Paid',
    transaction_reference TEXT,
    notes TEXT,
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    split_group_id TEXT,
    split_index INTEGER,
    split_type TEXT,
    split_item_names JSONB DEFAULT '[]'::jsonb
);

-- Index for high-performance order payments lookups
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Enable RLS and define open access policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read payments" ON public.payments;
CREATE POLICY "Allow public read payments" ON public.payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert payments" ON public.payments;
CREATE POLICY "Allow public insert payments" ON public.payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update payments" ON public.payments;
CREATE POLICY "Allow public update payments" ON public.payments FOR UPDATE USING (true);

-- 2. EXTEND ORDERS TABLE WITH PAYMENT SETTLEMENT COLUMNS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS split_settlements JSONB DEFAULT '[]'::jsonb;
