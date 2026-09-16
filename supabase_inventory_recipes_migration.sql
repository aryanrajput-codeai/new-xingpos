-- ====================================================================
-- WEBRAJYA POS / SAGAR RATNA - PHASE 1: INVENTORY & RECIPES DATABASE FOUNDATION
-- Migration: supabase_inventory_recipes_migration.sql
-- Description: Complete additive database foundation for recipes, ingredients,
--              suppliers, purchases, wastage, immutable ledger, and idempotency guards.
-- ====================================================================

-- Ensure required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 0. TENANT RESOLUTION & INTEGRITY HELPER FUNCTIONS
-- ====================================================================
-- Resolves the verified business/restaurant ID from authenticated session/JWT
-- without trusting client-supplied parameters.
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    claim_val TEXT;
    resolved_id UUID;
BEGIN
    -- 1. Inspect verified JWT claims (app_metadata or user_metadata)
    BEGIN
        claim_val := COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'business_id', ''),
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'restaurant_id', ''),
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'business_id', ''),
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'restaurant_id', ''),
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'business_id', ''),
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'restaurant_id', ''),
            NULLIF(current_setting('app.current_business_id', true), ''),
            NULLIF(current_setting('app.current_restaurant_id', true), '')
        );
    EXCEPTION WHEN OTHERS THEN
        claim_val := NULL;
    END;

    IF claim_val IS NOT NULL AND claim_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN claim_val::UUID;
    END IF;

    -- 2. Fallback to the registered active venue in single-tenant / local mode
    SELECT id INTO resolved_id FROM public.restaurants ORDER BY created_at ASC LIMIT 1;
    RETURN resolved_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Standard updated_at timestamp refresher
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Immutability enforcer for inventory_transactions
CREATE OR REPLACE FUNCTION public.prevent_inventory_transaction_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'inventory_transactions is an immutable audit ledger: records cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

-- Auto-tenant injection trigger to ensure business_id is always populated
CREATE OR REPLACE FUNCTION public.enforce_tenant_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.business_id IS NULL THEN
        NEW.business_id := public.get_current_tenant_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ====================================================================
-- 1. INGREDIENT CATEGORIES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.ingredient_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ingredient_categories_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ingredient_categories_business_id ON public.ingredient_categories(business_id);

CREATE TRIGGER trg_ingredient_categories_updated_at
    BEFORE UPDATE ON public.ingredient_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_ingredient_categories_tenant
    BEFORE INSERT ON public.ingredient_categories
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 2. INGREDIENTS TABLE (Master Raw Material Catalog)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.ingredient_categories(id) ON DELETE SET NULL,
    item_code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    min_alert_level NUMERIC(12, 3) NOT NULL DEFAULT 5.000,
    max_stock_level NUMERIC(12, 3) DEFAULT 100.000,
    reorder_quantity NUMERIC(12, 3) NOT NULL DEFAULT 20.000,
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    yield_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    storage_type TEXT DEFAULT 'DRY',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints & Validations
    CONSTRAINT chk_ingredients_min_alert CHECK (min_alert_level >= 0),
    CONSTRAINT chk_ingredients_max_stock CHECK (max_stock_level IS NULL OR max_stock_level >= 0),
    CONSTRAINT chk_ingredients_reorder_qty CHECK (reorder_quantity >= 0),
    CONSTRAINT chk_ingredients_cost CHECK (cost_per_unit >= 0),
    CONSTRAINT chk_ingredients_yield CHECK (yield_percentage > 0 AND yield_percentage <= 100),
    CONSTRAINT chk_ingredients_unit CHECK (unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box', 'can', 'bottle', 'pack', 'portion', 'unit')),
    CONSTRAINT chk_ingredients_storage CHECK (storage_type IN ('DRY', 'CHILLED', 'FROZEN', 'AMBIENT')),
    CONSTRAINT uq_ingredients_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ingredients_business_id ON public.ingredients(business_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category_id ON public.ingredients(category_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_low_stock ON public.ingredients(business_id, current_stock, min_alert_level);
CREATE INDEX IF NOT EXISTS idx_ingredients_item_code ON public.ingredients(business_id, item_code);

CREATE TRIGGER trg_ingredients_updated_at
    BEFORE UPDATE ON public.ingredients
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_ingredients_tenant
    BEFORE INSERT ON public.ingredients
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 3. RECIPES TABLE (Menu Item Bill of Materials Header)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    menu_item_id TEXT NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    recipe_name TEXT,
    portion_size NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    serving_unit TEXT NOT NULL DEFAULT 'portion',
    preparation_notes TEXT,
    labor_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    overhead_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_recipes_portion CHECK (portion_size > 0),
    CONSTRAINT chk_recipes_labor_cost CHECK (labor_cost >= 0),
    CONSTRAINT chk_recipes_overhead_cost CHECK (overhead_cost >= 0),
    -- Strictly 1 active recipe definition per menu item per business
    CONSTRAINT uq_recipes_business_menu_item UNIQUE (business_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_business_id ON public.recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON public.recipes(menu_item_id);

CREATE TRIGGER trg_recipes_updated_at
    BEFORE UPDATE ON public.recipes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_recipes_tenant
    BEFORE INSERT ON public.recipes
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 4. RECIPE ITEMS TABLE (Ingredient Quantities per Recipe)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 4) NOT NULL,
    unit TEXT NOT NULL,
    waste_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_recipe_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_recipe_items_waste CHECK (waste_percentage >= 0 AND waste_percentage < 100),
    CONSTRAINT chk_recipe_items_unit CHECK (unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box', 'can', 'bottle', 'pack', 'portion', 'unit')),
    -- Prevent duplicate ingredient lines in the same recipe
    CONSTRAINT uq_recipe_items_recipe_ingredient UNIQUE (recipe_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient_id ON public.recipe_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_business_id ON public.recipe_items(business_id);

CREATE TRIGGER trg_recipe_items_updated_at
    BEFORE UPDATE ON public.recipe_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_recipe_items_tenant
    BEFORE INSERT ON public.recipe_items
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 5. SUPPLIERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    supplier_code TEXT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    payment_terms TEXT DEFAULT 'Cash on Delivery',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_suppliers_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers(business_id);

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_suppliers_tenant
    BEFORE INSERT ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 6. PURCHASES TABLE (Procurement Orders & Inward Deliveries)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    purchase_number TEXT NOT NULL,
    invoice_number TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',
    payment_method TEXT DEFAULT 'Cash',
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_date TIMESTAMPTZ,
    notes TEXT,
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_purchases_status CHECK (status IN ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED', 'RETURNED')),
    CONSTRAINT chk_purchases_payment_status CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    CONSTRAINT chk_purchases_total_amount CHECK (total_amount >= 0),
    CONSTRAINT chk_purchases_tax_amount CHECK (tax_amount >= 0),
    CONSTRAINT chk_purchases_shipping_cost CHECK (shipping_cost >= 0),
    CONSTRAINT uq_purchases_business_number UNIQUE (business_id, purchase_number)
);

CREATE INDEX IF NOT EXISTS idx_purchases_business_id ON public.purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(business_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(business_id, purchase_date);

CREATE TRIGGER trg_purchases_updated_at
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_purchases_tenant
    BEFORE INSERT ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 7. PURCHASE ITEMS TABLE (Procured Ingredients Lines)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL,
    unit TEXT NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    batch_number TEXT,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_purchase_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_purchase_items_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_purchase_items_total_cost CHECK (total_cost >= 0),
    CONSTRAINT chk_purchase_items_unit CHECK (unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box', 'can', 'bottle', 'pack', 'portion', 'unit'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_ingredient_id ON public.purchase_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_business_id ON public.purchase_items(business_id);

CREATE TRIGGER trg_purchase_items_tenant
    BEFORE INSERT ON public.purchase_items
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 8. WASTAGE TABLE (Kitchen Spoilage & Prep Loss Tracking)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.wastage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL,
    unit TEXT NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_loss NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    reported_by TEXT NOT NULL DEFAULT 'Staff',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_wastage_quantity CHECK (quantity > 0),
    CONSTRAINT chk_wastage_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_wastage_total_loss CHECK (total_loss >= 0),
    CONSTRAINT chk_wastage_reason CHECK (reason IN ('SPOILAGE', 'PREPARATION_ERROR', 'EXPIRED', 'SPILLAGE', 'RETURN_FROM_CUSTOMER', 'EQUIPMENT_FAILURE', 'OTHER')),
    CONSTRAINT chk_wastage_unit CHECK (unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box', 'can', 'bottle', 'pack', 'portion', 'unit'))
);

CREATE INDEX IF NOT EXISTS idx_wastage_business_id ON public.wastage(business_id);
CREATE INDEX IF NOT EXISTS idx_wastage_ingredient_id ON public.wastage(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_wastage_created_at ON public.wastage(business_id, created_at);

CREATE TRIGGER trg_wastage_tenant
    BEFORE INSERT ON public.wastage
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 9. INVENTORY TRANSACTIONS TABLE (Immutable Audit Ledger)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL, -- signed delta (+restock, -consumption, -wastage)
    unit TEXT NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_before NUMERIC(12, 3) NOT NULL,
    stock_after NUMERIC(12, 3) NOT NULL,
    reference_id TEXT,             -- Order ID, Purchase ID, Wastage ID
    reference_item_id TEXT,        -- Order Item ID or Recipe Item ID
    notes TEXT,
    performed_by TEXT NOT NULL DEFAULT 'System',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_inv_trans_type CHECK (transaction_type IN ('OPENING_STOCK', 'PURCHASE_RECEIPT', 'ORDER_CONSUMPTION', 'ORDER_RESTORE', 'WASTAGE', 'MANUAL_ADJUSTMENT', 'STOCKTAKE_RECONCILE', 'RETURN')),
    CONSTRAINT chk_inv_trans_quantity CHECK (quantity != 0),
    CONSTRAINT chk_inv_trans_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_inv_trans_total_cost CHECK (total_cost >= 0),
    CONSTRAINT chk_inv_trans_unit CHECK (unit IN ('kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box', 'can', 'bottle', 'pack', 'portion', 'unit'))
);

CREATE INDEX IF NOT EXISTS idx_inv_trans_business_id ON public.inventory_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_ingredient_id ON public.inventory_transactions(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_created_at ON public.inventory_transactions(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inv_trans_ref_id ON public.inventory_transactions(business_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_type ON public.inventory_transactions(business_id, transaction_type);

-- Idempotency protection for opening stock: strictly 1 opening stock per ingredient per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_trans_opening_stock_idempotency
    ON public.inventory_transactions (business_id, ingredient_id)
    WHERE transaction_type = 'OPENING_STOCK';

-- Enforce strict immutability (NO UPDATE, NO DELETE allowed)
CREATE TRIGGER trg_protect_inventory_transactions
    BEFORE UPDATE OR DELETE ON public.inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_inventory_transaction_mutation();

CREATE TRIGGER trg_inventory_transactions_tenant
    BEFORE INSERT ON public.inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();


-- ====================================================================
-- 10. ORDER INVENTORY CONSUMPTIONS (POS Idempotency Ledger)
-- ====================================================================
-- Guarantees that an order's raw material recipe can only be deducted ONCE.
CREATE TABLE IF NOT EXISTS public.order_inventory_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'CONSUMED',
    total_items_consumed INTEGER NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reversed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT uq_order_inventory_consumption UNIQUE (business_id, order_id),
    CONSTRAINT chk_consumption_status CHECK (status IN ('CONSUMED', 'REVERSED', 'PARTIALLY_REVERSED'))
);

CREATE INDEX IF NOT EXISTS idx_order_inv_consumptions_order_id ON public.order_inventory_consumptions(order_id);
CREATE INDEX IF NOT EXISTS idx_order_inv_consumptions_business_id ON public.order_inventory_consumptions(business_id);

CREATE TRIGGER trg_order_inv_consumptions_tenant
    BEFORE INSERT ON public.order_inventory_consumptions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_integrity();

-- Additional granular idempotency guard on transaction level:
-- Ensures an identical order item cannot log multiple order consumptions for the same ingredient.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_trans_order_item_idempotency
    ON public.inventory_transactions (business_id, reference_id, reference_item_id, ingredient_id)
    WHERE transaction_type = 'ORDER_CONSUMPTION' AND reference_item_id IS NOT NULL;


-- ====================================================================
-- 11. ROW LEVEL SECURITY (RLS) MULTI-TENANT ISOLATION
-- ====================================================================

-- 1. ingredient_categories
ALTER TABLE public.ingredient_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for ingredient_categories select" ON public.ingredient_categories;
CREATE POLICY "Tenant isolation for ingredient_categories select"
    ON public.ingredient_categories FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ingredient_categories insert" ON public.ingredient_categories;
CREATE POLICY "Tenant isolation for ingredient_categories insert"
    ON public.ingredient_categories FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ingredient_categories update" ON public.ingredient_categories;
CREATE POLICY "Tenant isolation for ingredient_categories update"
    ON public.ingredient_categories FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ingredient_categories delete" ON public.ingredient_categories;
CREATE POLICY "Tenant isolation for ingredient_categories delete"
    ON public.ingredient_categories FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 2. ingredients
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for ingredients select" ON public.ingredients;
CREATE POLICY "Tenant isolation for ingredients select"
    ON public.ingredients FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ingredients insert" ON public.ingredients;
CREATE POLICY "Tenant isolation for ingredients insert"
    ON public.ingredients FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ingredients update" ON public.ingredients;
CREATE POLICY "Tenant isolation for ingredients update"
    ON public.ingredients FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for ingredients delete" ON public.ingredients;
CREATE POLICY "Tenant isolation for ingredients delete"
    ON public.ingredients FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 3. recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for recipes select" ON public.recipes;
CREATE POLICY "Tenant isolation for recipes select"
    ON public.recipes FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for recipes insert" ON public.recipes;
CREATE POLICY "Tenant isolation for recipes insert"
    ON public.recipes FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for recipes update" ON public.recipes;
CREATE POLICY "Tenant isolation for recipes update"
    ON public.recipes FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for recipes delete" ON public.recipes;
CREATE POLICY "Tenant isolation for recipes delete"
    ON public.recipes FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 4. recipe_items
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for recipe_items select" ON public.recipe_items;
CREATE POLICY "Tenant isolation for recipe_items select"
    ON public.recipe_items FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for recipe_items insert" ON public.recipe_items;
CREATE POLICY "Tenant isolation for recipe_items insert"
    ON public.recipe_items FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for recipe_items update" ON public.recipe_items;
CREATE POLICY "Tenant isolation for recipe_items update"
    ON public.recipe_items FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for recipe_items delete" ON public.recipe_items;
CREATE POLICY "Tenant isolation for recipe_items delete"
    ON public.recipe_items FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 5. suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for suppliers select" ON public.suppliers;
CREATE POLICY "Tenant isolation for suppliers select"
    ON public.suppliers FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for suppliers insert" ON public.suppliers;
CREATE POLICY "Tenant isolation for suppliers insert"
    ON public.suppliers FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for suppliers update" ON public.suppliers;
CREATE POLICY "Tenant isolation for suppliers update"
    ON public.suppliers FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for suppliers delete" ON public.suppliers;
CREATE POLICY "Tenant isolation for suppliers delete"
    ON public.suppliers FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 6. purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for purchases select" ON public.purchases;
CREATE POLICY "Tenant isolation for purchases select"
    ON public.purchases FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchases insert" ON public.purchases;
CREATE POLICY "Tenant isolation for purchases insert"
    ON public.purchases FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchases update" ON public.purchases;
CREATE POLICY "Tenant isolation for purchases update"
    ON public.purchases FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchases delete" ON public.purchases;
CREATE POLICY "Tenant isolation for purchases delete"
    ON public.purchases FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 7. purchase_items
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for purchase_items select" ON public.purchase_items;
CREATE POLICY "Tenant isolation for purchase_items select"
    ON public.purchase_items FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchase_items insert" ON public.purchase_items;
CREATE POLICY "Tenant isolation for purchase_items insert"
    ON public.purchase_items FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchase_items update" ON public.purchase_items;
CREATE POLICY "Tenant isolation for purchase_items update"
    ON public.purchase_items FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for purchase_items delete" ON public.purchase_items;
CREATE POLICY "Tenant isolation for purchase_items delete"
    ON public.purchase_items FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 8. wastage
ALTER TABLE public.wastage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for wastage select" ON public.wastage;
CREATE POLICY "Tenant isolation for wastage select"
    ON public.wastage FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for wastage insert" ON public.wastage;
CREATE POLICY "Tenant isolation for wastage insert"
    ON public.wastage FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for wastage update" ON public.wastage;
CREATE POLICY "Tenant isolation for wastage update"
    ON public.wastage FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for wastage delete" ON public.wastage;
CREATE POLICY "Tenant isolation for wastage delete"
    ON public.wastage FOR DELETE
    USING (business_id = public.get_current_tenant_id());


-- 9. inventory_transactions (IMMUTABLE AUDIT LEDGER: SELECT & INSERT ONLY)
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for inventory_transactions select" ON public.inventory_transactions;
CREATE POLICY "Tenant isolation for inventory_transactions select"
    ON public.inventory_transactions FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for inventory_transactions insert" ON public.inventory_transactions;
CREATE POLICY "Tenant isolation for inventory_transactions insert"
    ON public.inventory_transactions FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());


-- 10. order_inventory_consumptions
ALTER TABLE public.order_inventory_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation for order_inventory_consumptions select" ON public.order_inventory_consumptions;
CREATE POLICY "Tenant isolation for order_inventory_consumptions select"
    ON public.order_inventory_consumptions FOR SELECT
    USING (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for order_inventory_consumptions insert" ON public.order_inventory_consumptions;
CREATE POLICY "Tenant isolation for order_inventory_consumptions insert"
    ON public.order_inventory_consumptions FOR INSERT
    WITH CHECK (business_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for order_inventory_consumptions update" ON public.order_inventory_consumptions;
CREATE POLICY "Tenant isolation for order_inventory_consumptions update"
    ON public.order_inventory_consumptions FOR UPDATE
    USING (business_id = public.get_current_tenant_id())
    WITH CHECK (business_id = public.get_current_tenant_id());
