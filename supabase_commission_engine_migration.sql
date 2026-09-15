-- ====================================================================
-- SUPABASE COMMISSION ENGINE DATABASE MIGRATION & SCHEMAS
-- Location: /supabase_commission_engine_migration.sql
-- Description: Complete schema definitions, indexes, foreign keys, constraints, and Row Level Security (RLS) policies.
-- Generated: 2026-06-21 UTC
-- ====================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. RESTAURANTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00, -- e.g., 10.00%
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on restaurants
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies
DROP POLICY IF EXISTS "Allow public read access to restaurants" ON public.restaurants;
CREATE POLICY "Allow public read access to restaurants"
    ON public.restaurants FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage access to restaurants" ON public.restaurants;
CREATE POLICY "Allow authenticated manage access to restaurants"
    ON public.restaurants FOR ALL TO authenticated USING (true);


-- ====================================================================
-- 2. ORDERS TABLE (Ensuring table properties match core schema)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, -- text base ID
    table_number TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    service_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    order_status TEXT NOT NULL DEFAULT 'New Order',
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies
DROP POLICY IF EXISTS "Allow public select/insert orders" ON public.orders;
CREATE POLICY "Allow public select/insert orders"
    ON public.orders FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public insert access to orders" ON public.orders;
CREATE POLICY "Allow public insert access to orders"
    ON public.orders FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to orders" ON public.orders;
CREATE POLICY "Allow public update access to orders"
    ON public.orders FOR UPDATE TO public USING (true);


-- ====================================================================
-- 3. SETTLEMENTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    transaction_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requested Indexes 
CREATE INDEX IF NOT EXISTS settlements_restaurant_id_idx ON public.settlements(restaurant_id);
CREATE INDEX IF NOT EXISTS settlements_payment_status_idx ON public.settlements(payment_status);

-- Enable RLS on settlements
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies for settlements
DROP POLICY IF EXISTS "Allow public read settlements" ON public.settlements;
CREATE POLICY "Allow public read settlements"
    ON public.settlements FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage settlements" ON public.settlements;
CREATE POLICY "Allow authenticated manage settlements"
    ON public.settlements FOR ALL TO authenticated USING (true);


-- ====================================================================
-- 4. COMMISSIONS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL, -- references physical text ID of order
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Settled'
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Mandatory task criteria constraint: UNIQUE(order_id)
    CONSTRAINT commissions_order_id_unique UNIQUE(order_id)
);

-- Requested Indexes
CREATE INDEX IF NOT EXISTS commissions_restaurant_id_idx ON public.commissions(restaurant_id);
CREATE INDEX IF NOT EXISTS commissions_created_at_idx ON public.commissions(created_at);

-- Enable RLS on commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies for commissions
DROP POLICY IF EXISTS "Allow public read commissions" ON public.commissions;
CREATE POLICY "Allow public read commissions"
    ON public.commissions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage commissions" ON public.commissions;
CREATE POLICY "Allow authenticated manage commissions"
    ON public.commissions FOR ALL TO authenticated USING (true);


-- ====================================================================
-- 5. INVOICES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    settlement_id UUID UNIQUE REFERENCES public.settlements(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'Issued', -- 'Issued', 'Paid', 'Overdue', 'Cancelled'
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Requested Indexes
CREATE INDEX IF NOT EXISTS invoices_restaurant_id_idx ON public.invoices(restaurant_id);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies for invoices
DROP POLICY IF EXISTS "Allow public read invoices" ON public.invoices;
CREATE POLICY "Allow public read invoices"
    ON public.invoices FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage invoices" ON public.invoices;
CREATE POLICY "Allow authenticated manage invoices"
    ON public.invoices FOR ALL TO authenticated USING (true);


-- ====================================================================
-- 6. COMMISSION_AUDIT_LOGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.commission_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL, -- e.g., 'INSERT', 'UPDATE', 'SETTLE'
    table_name TEXT NOT NULL, -- e.g., 'commissions', 'settlements'
    record_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on commission_audit_logs
ALTER TABLE public.commission_audit_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies for commission_audit_logs
DROP POLICY IF EXISTS "Allow public read commission_audit_logs" ON public.commission_audit_logs;
CREATE POLICY "Allow public read commission_audit_logs"
    ON public.commission_audit_logs FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert commission_audit_logs" ON public.commission_audit_logs;
CREATE POLICY "Allow authenticated insert commission_audit_logs"
    ON public.commission_audit_logs FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated manage commission_audit_logs" ON public.commission_audit_logs;
CREATE POLICY "Allow authenticated manage commission_audit_logs"
    ON public.commission_audit_logs FOR ALL TO authenticated USING (true);


-- ====================================================================
-- 7. OPTIONAL AUTOMATIC TRIGGERS FOR COMMISSION CALCULATION
-- ====================================================================
-- Creates a generic triggers functions to audit and log actions when required.
CREATE OR REPLACE FUNCTION public.log_commission_audit_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.commission_audit_logs(action, table_name, record_id, old_data, new_data, performed_by)
    VALUES (
        TG_OP,
        TG_TABLE_NAME::text,
        COALESCE(NEW.id::text, OLD.id::text),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        current_setting('role', true)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind audit logs to commissions and settlements
DROP TRIGGER IF EXISTS trg_audit_commissions ON public.commissions;
CREATE TRIGGER trg_audit_commissions
    AFTER INSERT OR UPDATE OR DELETE ON public.commissions
    FOR EACH ROW EXECUTE FUNCTION public.log_commission_audit_action();

DROP TRIGGER IF EXISTS trg_audit_settlements ON public.settlements;
CREATE TRIGGER trg_audit_settlements
    AFTER INSERT OR UPDATE OR DELETE ON public.settlements
    FOR EACH ROW EXECUTE FUNCTION public.log_commission_audit_action();
