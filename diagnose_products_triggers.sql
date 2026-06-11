-- ============================================================
-- FIX: "cannot cast type products to jsonb" error
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Step 1: DIAGNOSE — Find all triggers on the products table
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'products';

-- Step 2: DIAGNOSE — Show the trigger function source code
SELECT p.proname AS function_name, 
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p 
JOIN pg_trigger t ON t.tgfoid = p.oid 
JOIN pg_class c ON t.tgrelid = c.oid 
WHERE c.relname = 'products';
