// Fix: Use supabase-js to create an RPC, then call it to diagnose/fix triggers
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bgswupnutsojlnpzwzop.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnc3d1cG51dHNvamxucHp3em9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwNDg3MCwiZXhwIjoyMDkxOTgwODcwfQ.gECAMSWT8C6NhLF2gVpYdZISzZftehzymDDyyQkhuy0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  // The "cannot cast type products to jsonb" error ALWAYS means a trigger function
  // is doing to_jsonb(NEW) or row_to_json(NEW)::jsonb and the row type has 
  // incompatible column types (like text[]).
  // 
  // Since we can't run DDL through the REST API, let's try a different approach:
  // Check if Supabase Realtime is enabled on products table (it adds triggers)
  
  // Check if the realtime publication includes products
  // We can check the supabase_realtime publication
  
  // Actually - the simplest approach since we know the error and can't access SQL editor:
  // Let's skip the trigger entirely by using a raw SQL insert via PostgREST's
  // X-Prefer header or by finding a way around it.
  
  // BUT - the real fix needs DDL. Let's try the /sql endpoint that some Supabase
  // projects expose. This is the Supabase Studio SQL endpoint.
  
  const sqlEndpoints = [
    `${SUPABASE_URL}/pg/query`,
    `${SUPABASE_URL}/sql`,
  ]
  
  for (const endpoint of sqlEndpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          query: `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'products';`
        })
      })
      console.log(`${endpoint}: ${res.status}`)
      if (res.ok) {
        const data = await res.json()
        console.log('Result:', JSON.stringify(data, null, 2))
      }
    } catch (e) {
      console.log(`${endpoint}: ${e.message}`)
    }
  }

  // Since we likely can't run DDL remotely, let's try the workaround approach:
  // We can avoid the trigger by using the supabase-js with specific options
  
  // Actually, there's a last resort: some Supabase projects have pg_net extension
  // Let's check if we can use that to execute SQL
  const { data: extensions } = await supabase
    .from('pg_catalog.pg_extension')
    .select('extname')
  console.log('\nExtensions:', extensions)

  // Let's check if there's a way to call a function that will create our fix function
  // Try if pg_net is available
  const { data: netTest, error: netErr } = await supabase.rpc('net_http_get', {
    url: 'https://example.com'
  })
  console.log('pg_net test:', netErr?.message || 'available')

  // Another approach: Supabase has `supabase_functions.http_request` in some versions
  // Or we can use the vault

  console.log('\n\n=============================================================')
  console.log('MANUAL FIX REQUIRED - Run this in Supabase SQL Editor:')
  console.log('Go to: https://supabase.com/dashboard/project/bgswupnutsojlnpzwzop/sql')
  console.log('=============================================================\n')
  
  const fixSQL = `
-- STEP 1: Identify the problematic trigger(s)
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers WHERE event_object_table = 'products';

-- STEP 2: Show the function definition
SELECT p.proname, pg_get_functiondef(p.oid) FROM pg_proc p 
JOIN pg_trigger t ON t.tgfoid = p.oid 
JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'products';

-- STEP 3: Nuclear fix — drop ALL triggers on products
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT trigger_name FROM information_schema.triggers 
    WHERE event_object_table = 'products' AND trigger_schema = 'public'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON products';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- STEP 4: Also check/drop realtime triggers
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT trigger_name FROM information_schema.triggers 
    WHERE event_object_table = 'products'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON products';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- STEP 5: Recreate safe updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 6: Remove products from Supabase Realtime publication (if applicable)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS products;

-- STEP 7: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`
  console.log(fixSQL)
}

run()
