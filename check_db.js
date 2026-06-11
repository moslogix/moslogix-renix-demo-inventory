import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bgswupnutsojlnpzwzop.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnc3d1cG51dHNvamxucHp3em9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwNDg3MCwiZXhwIjoyMDkxOTgwODcwfQ.gECAMSWT8C6NhLF2gVpYdZISzZftehzymDDyyQkhuy0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkDb() {
  const { data, error } = await supabase.rpc('get_table_info')
  if (error) {
    // try querying directly if possible via rest
    const { data: qData, error: qError } = await supabase.from('products').select('*').limit(1)
    console.log('Products sample:', qData, qError)
  } else {
    console.log('RPC result:', data)
  }
}

checkDb()
