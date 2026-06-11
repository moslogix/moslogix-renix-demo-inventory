-- ============================================================
-- Renix Inventory — Database Schema Migration (Fixed)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Step 1: Drop dependent views FIRST ────────────────────────
-- Required before altering products table (view depends on it)
DROP VIEW IF EXISTS current_stock CASCADE;
DROP VIEW IF EXISTS revenue_summary CASCADE;
DROP VIEW IF EXISTS product_sales_summary CASCADE;

-- ── Step 2: products — add missing columns ─────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url            TEXT,
  ADD COLUMN IF NOT EXISTS images               TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_taxable           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_category         TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold  INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS description          TEXT,
  ADD COLUMN IF NOT EXISTS sku                  TEXT,
  ADD COLUMN IF NOT EXISTS barcode              TEXT,
  ADD COLUMN IF NOT EXISTS cost_price           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT now();

-- ── Step 3: product_variants ───────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  sku                  TEXT,
  barcode              TEXT,
  attributes           JSONB NOT NULL DEFAULT '{}',
  price_override       NUMERIC(12,2),
  cost_price_override  NUMERIC(12,2),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 4: categories ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL,
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 5: suppliers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 6: branches ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 7: stock_movements ────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id      UUID NOT NULL REFERENCES branches(id),
  variant_id     UUID REFERENCES product_variants(id),
  quantity       INTEGER NOT NULL,
  movement_type  TEXT NOT NULL CHECK (movement_type IN
                   ('purchase','sale','return','adjustment','transfer','initial')),
  reference_id   UUID,
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 8: purchase_orders ────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL,
  branch_id      UUID REFERENCES branches(id),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id),
  po_number      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN
                     ('draft','submitted','confirmed','in_transit','received','cancelled')),
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  expected_date  DATE,
  received_date  TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 9: purchase_order_items ───────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  variant_id          UUID REFERENCES product_variants(id),
  quantity_ordered    INTEGER NOT NULL DEFAULT 0,
  quantity_received   INTEGER NOT NULL DEFAULT 0,
  unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 10: tax_rules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  rate       NUMERIC(5,4) NOT NULL DEFAULT 0.14,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 11: stores ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  logo_url     TEXT,
  vat_rate     NUMERIC(5,4) NOT NULL DEFAULT 0.14,
  settings     JSONB NOT NULL DEFAULT '{}',
  theme_config JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 12: profiles — add missing columns ────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_id       UUID,
  ADD COLUMN IF NOT EXISTS branch_id      UUID,
  ADD COLUMN IF NOT EXISTS full_name      TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS role           TEXT NOT NULL DEFAULT 'store_admin',
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata       JSONB NOT NULL DEFAULT '{}';

-- ── Step 13: Recreate current_stock VIEW ──────────────────────
-- (dropped in step 1 so this is a clean CREATE, not REPLACE)
CREATE VIEW current_stock AS
SELECT
  sm.product_id,
  sm.branch_id,
  SUM(sm.quantity)                          AS quantity,
  p.name                                    AS product_name,
  p.low_stock_threshold,
  SUM(sm.quantity) <= p.low_stock_threshold AS is_low_stock
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
GROUP BY
  sm.product_id, sm.branch_id,
  p.name, p.low_stock_threshold;

-- ── Step 14: Storage bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('renix-storage', 'renix-storage', true)
ON CONFLICT (id) DO NOTHING;

-- ── Step 15: Storage policies ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'renix_storage_insert'
  ) THEN
    CREATE POLICY renix_storage_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'renix-storage');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'renix_storage_select'
  ) THEN
    CREATE POLICY renix_storage_select ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'renix-storage');
  END IF;
END $$;

-- ── Step 16: Disable RLS (development only) ────────────────────
ALTER TABLE products             DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories           DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches             DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants     DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules            DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             DISABLE ROW LEVEL SECURITY;

-- ── Step 17: Reload PostgREST schema cache ─────────────────────
NOTIFY pgrst, 'reload schema';
