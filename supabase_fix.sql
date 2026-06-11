-- ============================================================
-- Renix Inventory — Targeted Column Fix
-- Run AFTER the diagnostic to fix missing/misnamed columns
-- ============================================================

-- Drop dependent views first
DROP VIEW IF EXISTS current_stock CASCADE;

-- Add ALL columns the app expects (safe to run even if they exist)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS name                TEXT,
  ADD COLUMN IF NOT EXISTS store_id            UUID,
  ADD COLUMN IF NOT EXISTS category_id         UUID,
  ADD COLUMN IF NOT EXISTS supplier_id         UUID,
  ADD COLUMN IF NOT EXISTS price               NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sku                 TEXT,
  ADD COLUMN IF NOT EXISTS barcode             TEXT,
  ADD COLUMN IF NOT EXISTS description         TEXT,
  ADD COLUMN IF NOT EXISTS image_url           TEXT,
  ADD COLUMN IF NOT EXISTS images              TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_taxable          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_category        TEXT,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();

-- OPTIONAL: If your table uses a different column name for price,
-- uncomment and adjust the line below:
-- UPDATE products SET price = selling_price WHERE price = 0 AND selling_price IS NOT NULL;

-- Recreate current_stock view
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

-- Fix storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('renix-storage', 'renix-storage', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Fix storage policies — drop and recreate cleanly
DROP POLICY IF EXISTS renix_storage_insert ON storage.objects;
DROP POLICY IF EXISTS renix_storage_select ON storage.objects;
DROP POLICY IF EXISTS renix_storage_update ON storage.objects;
DROP POLICY IF EXISTS renix_storage_delete ON storage.objects;

CREATE POLICY renix_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'renix-storage');

CREATE POLICY renix_storage_select ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'renix-storage');

CREATE POLICY renix_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'renix-storage');

CREATE POLICY renix_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'renix-storage');

-- Disable RLS on all tables (dev mode)
ALTER TABLE products             DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories           DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches             DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants     DISABLE ROW LEVEL SECURITY;

-- Reload schema cache — makes all new columns visible immediately
NOTIFY pgrst, 'reload schema';
