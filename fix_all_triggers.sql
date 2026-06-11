-- ============================================================
-- FIX: "cannot cast type X to jsonb" errors across tables
-- Run this ENTIRE script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bgswupnutsojlnpzwzop/sql
-- ============================================================

-- STEP 1: Drop ALL triggers on stock_movements table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'stock_movements'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON stock_movements';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- STEP 2: Remove all relevant tables from the realtime publication
-- This prevents the realtime system from trying to cast the rows to jsonb
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS products, stock_movements, categories, suppliers, branches';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not modify publication: %', SQLERRM;
END $$;

-- STEP 3: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
