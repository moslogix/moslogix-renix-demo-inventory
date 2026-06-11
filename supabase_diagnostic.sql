-- ============================================================
-- STEP A: Run this first to see what columns currently exist
-- ============================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;

-- Also check if current_stock view exists
SELECT viewname FROM pg_views WHERE schemaname = 'public';
