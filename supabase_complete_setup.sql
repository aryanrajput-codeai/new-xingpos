-- ====================================================================
-- SAGAR RATNA RESTAURANT CONTROL HUB - COMPLETE DATABASE SETUP
-- Description: Table schemas, indexes, and full public RLS policies.
-- ====================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SETTINGS TABLE (Store configurations)
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'singleton-config',
    name TEXT NOT NULL DEFAULT 'Sagar Ratna',
    contact_number TEXT NOT NULL DEFAULT '+91-96300-13483',
    address TEXT,
    business_hours TEXT NOT NULL DEFAULT '11:00 AM - 11:30 PM DAILY',
    delivery_charges NUMERIC(10, 2) DEFAULT 25.00,
    gst_percentage NUMERIC(5, 2) DEFAULT 5.00,
    facebook_url TEXT,
    instagram_url TEXT,
    twitter_url TEXT,
    google_maps_url TEXT
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write settings" ON public.settings;
CREATE POLICY "Allow public write settings" ON public.settings FOR ALL USING (true);

-- Seed Initial Default Config
INSERT INTO public.settings (
    id, name, contact_number, address, business_hours, delivery_charges, gst_percentage, facebook_url, instagram_url, twitter_url
) VALUES (
    'singleton-config', 
    'Sagar Ratna', 
    '+91-96300-13483', 
    'Sagar Ratna, Ground Floor, Commercial Complex, Sector 15, New Delhi', 
    '11:00 AM - 11:30 PM DAILY', 
    25.00, 
    5.00, 
    'https://facebook.com', 
    'https://instagram.com', 
    'https://twitter.com'
) ON CONFLICT (id) DO NOTHING;


-- 2. MENU ITEMS TABLE (Dish Catalog)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    category TEXT,
    description TEXT,
    is_veg BOOLEAN DEFAULT true,
    is_bestseller BOOLEAN DEFAULT false,
    is_chef_special BOOLEAN DEFAULT false,
    image TEXT,
    spiciness INTEGER DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 4.5,
    rating_count INTEGER DEFAULT 10
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read menu_items" ON public.menu_items;
CREATE POLICY "Allow public read menu_items" ON public.menu_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write menu_items" ON public.menu_items;
CREATE POLICY "Allow public write menu_items" ON public.menu_items FOR ALL USING (true);


-- 3. RESTAURANTS TABLE (Commission Engine Core)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read restaurants" ON public.restaurants;
CREATE POLICY "Allow public read restaurants" ON public.restaurants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated manage restaurants" ON public.restaurants;
CREATE POLICY "Allow authenticated manage restaurants" ON public.restaurants FOR ALL USING (true);


-- 4. ORDERS TABLE (Dynamic Dinner & Appointment Booking System)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    phone_number TEXT,
    customer_phone TEXT,
    email TEXT,
    order_type TEXT NOT NULL DEFAULT 'takeaway',
    table_number TEXT,
    address TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    gst NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    service_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    packaging_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    applied_coupon TEXT,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    order_status TEXT NOT NULL DEFAULT 'New Order',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
    kot_number TEXT,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read orders" ON public.orders;
CREATE POLICY "Allow public read orders" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert orders" ON public.orders;
CREATE POLICY "Allow public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update orders" ON public.orders;
CREATE POLICY "Allow public update orders" ON public.orders FOR UPDATE USING (true);


-- 5. ORDER ITEMS TABLE (Individual Checkout Items)
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id TEXT,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL DEFAULT 1,
    customization TEXT
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read order_items" ON public.order_items;
CREATE POLICY "Allow public read order_items" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert order_items" ON public.order_items;
CREATE POLICY "Allow public insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update order_items" ON public.order_items;
CREATE POLICY "Allow public update order_items" ON public.order_items FOR UPDATE USING (true);


-- 6. KOTS TABLE (Kitchen Order Tickets)
CREATE TABLE IF NOT EXISTS public.kots (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    table_number TEXT,
    customer_name TEXT,
    order_type TEXT,
    status TEXT NOT NULL DEFAULT 'New Order',
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    preparation_time INTEGER DEFAULT 15,
    printed BOOLEAN DEFAULT false,
    items JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.kots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read kots" ON public.kots;
CREATE POLICY "Allow public read kots" ON public.kots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write kots" ON public.kots;
CREATE POLICY "Allow public write kots" ON public.kots FOR ALL USING (true);


-- 7. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    unit TEXT NOT NULL DEFAULT 'kg',
    min_alert_level NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    category TEXT,
    last_restocked TEXT
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read inventory" ON public.inventory;
CREATE POLICY "Allow public read inventory" ON public.inventory FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write inventory" ON public.inventory;
CREATE POLICY "Allow public write inventory" ON public.inventory FOR ALL USING (true);


-- 8. COUPONS TABLE
CREATE TABLE IF NOT EXISTS public.coupons (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'percentage',
    value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    expiry_date TEXT NOT NULL DEFAULT '2200-12-31',
    usage_limit INTEGER NOT NULL DEFAULT 100,
    usage_count INTEGER NOT NULL DEFAULT 0,
    min_order_amount NUMERIC(10, 2)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read coupons" ON public.coupons;
CREATE POLICY "Allow public read coupons" ON public.coupons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write coupons" ON public.coupons;
CREATE POLICY "Allow public write coupons" ON public.coupons FOR ALL USING (true);


-- 9. REVIEWS TABLE (Guest Book)
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    comment TEXT,
    avatar TEXT
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read reviews" ON public.reviews;
CREATE POLICY "Allow public read reviews" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write reviews" ON public.reviews;
CREATE POLICY "Allow public write reviews" ON public.reviews FOR ALL USING (true);


-- 10. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    "user" TEXT NOT NULL DEFAULT 'Admin',
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT DEFAULT '127.0.0.1'
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read audit_logs" ON public.audit_logs;
CREATE POLICY "Allow public read audit_logs" ON public.audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write audit_logs" ON public.audit_logs;
CREATE POLICY "Allow public write audit_logs" ON public.audit_logs FOR ALL USING (true);


-- 11. PRINTER EMULATOR LOGS
CREATE TABLE IF NOT EXISTS public.printer_emulator_logs (
    id TEXT PRIMARY KEY,
    kot_id TEXT,
    kot_number TEXT,
    restaurant_id TEXT,
    receipt_text TEXT,
    print_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.printer_emulator_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read printer_emulator_logs" ON public.printer_emulator_logs;
CREATE POLICY "Allow public read printer_emulator_logs" ON public.printer_emulator_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write printer_emulator_logs" ON public.printer_emulator_logs;
CREATE POLICY "Allow public write printer_emulator_logs" ON public.printer_emulator_logs FOR ALL USING (true);


-- 12. SETTLEMENTS TABLE (Commission Engine Settings Connection)
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    transaction_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read settlements" ON public.settlements;
CREATE POLICY "Allow public read settlements" ON public.settlements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated manage settlements" ON public.settlements;
CREATE POLICY "Allow authenticated manage settlements" ON public.settlements FOR ALL USING (true);


-- 13. COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    settlement_id UUID REFERENCES public.settlements(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT commissions_order_id_unique UNIQUE(order_id)
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read commissions" ON public.commissions;
CREATE POLICY "Allow public read commissions" ON public.commissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated manage commissions" ON public.commissions;
CREATE POLICY "Allow authenticated manage commissions" ON public.commissions FOR ALL USING (true);


-- 14. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    settlement_id UUID UNIQUE REFERENCES public.settlements(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'Issued',
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read invoices" ON public.invoices;
CREATE POLICY "Allow public read invoices" ON public.invoices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated manage invoices" ON public.invoices;
CREATE POLICY "Allow authenticated manage invoices" ON public.invoices FOR ALL USING (true);


-- 15. COMMISSION AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.commission_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read commission_audit_logs" ON public.commission_audit_logs;
CREATE POLICY "Allow public read commission_audit_logs" ON public.commission_audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert commission_audit_logs" ON public.commission_audit_logs;
CREATE POLICY "Allow public insert commission_audit_logs" ON public.commission_audit_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public manage commission_audit_logs" ON public.commission_audit_logs;
CREATE POLICY "Allow public manage commission_audit_logs" ON public.commission_audit_logs FOR ALL USING (true);
