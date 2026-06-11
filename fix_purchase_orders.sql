-- ============================================================
-- FIX: Missing columns in purchase_orders
-- Run this ENTIRE script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bgswupnutsojlnpzwzop/sql
-- ============================================================

-- Add all potentially missing columns to purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS store_id       UUID,
  ADD COLUMN IF NOT EXISTS branch_id      UUID,
  ADD COLUMN IF NOT EXISTS supplier_id    UUID,
  ADD COLUMN IF NOT EXISTS po_number      TEXT,
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS subtotal       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount     NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total          NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes          TEXT,
  ADD COLUMN IF NOT EXISTS expected_date  DATE,
  ADD COLUMN IF NOT EXISTS received_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by     UUID,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

-- Ensure purchase_order_items has everything too
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS purchase_order_id   UUID,
  ADD COLUMN IF NOT EXISTS product_id          UUID,
  ADD COLUMN IF NOT EXISTS variant_id          UUID,
  ADD COLUMN IF NOT EXISTS quantity_ordered    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_received   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost          NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ DEFAULT now();

-- Drop triggers on purchase orders just in case
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT trigger_name FROM information_schema.triggers WHERE event_object_table IN ('purchase_orders', 'purchase_order_items')
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON ' || r.event_object_table;
  END LOOP;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
