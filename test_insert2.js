import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bgswupnutsojlnpzwzop.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnc3d1cG51dHNvamxucHp3em9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwNDg3MCwiZXhwIjoyMDkxOTgwODcwfQ.gECAMSWT8C6NhLF2gVpYdZISzZftehzymDDyyQkhuy0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testInsert() {
  const { data: data2, error: error2 } = await supabase.from('products').insert({
    id: 'f0000000-0000-0000-0000-000000000002',
    store_id: '2d8c35bf-3e32-4a6d-9357-d94841e7fc9d',
    name: 'Test Product 3',
    sku: 'TEST-SKU-3',
    selling_price: 10,
    cost_price: 5,
    images: [],
    metadata: {},
    unit: 'piece'
  })
  console.log('Result of insert with all fields:', error2)
}

testInsert()
