-- ============================================================
-- FIX: "cannot cast type products to jsonb" error
-- Run this ENTIRE script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bgswupnutsojlnpzwzop/sql
-- ============================================================

-- STEP 1: Show all triggers (for your reference)
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'products';

-- STEP 2: Drop ALL triggers on products table (nuclear but safe)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'products'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON products';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- STEP 3: Recreate ONLY the safe updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- STEP 4: Remove products from Realtime publication (if it was added)
-- This prevents the realtime system from trying to cast the row to jsonb
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS products';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not modify publication: %', SQLERRM;
END $$;

-- STEP 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- STEP 6: Verify fix with a test insert
INSERT INTO products (store_id, name, sku, selling_price, cost_price, images, metadata, unit)
VALUES (
  '2d8c35bf-3e32-4a6d-9357-d94841e7fc9d',
  'Test Fix Product',
  'FIX-TEST-001',
  10, 5, '{}', '{}', 'piece'
);

-- Cleanup test row
DELETE FROM products WHERE sku = 'FIX-TEST-001';
