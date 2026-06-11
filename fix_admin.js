import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bgswupnutsojlnpzwzop.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnc3d1cG51dHNvamxucHp3em9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwNDg3MCwiZXhwIjoyMDkxOTgwODcwfQ.gECAMSWT8C6NhLF2gVpYdZISzZftehzymDDyyQkhuy0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fix() {
  const adminId = '82d97614-2711-4951-a6a9-94119d308dd1'

  try {
    // 1. Get or create a store
    let { data: stores, error: storeError } = await supabase.from('stores').select('*').limit(1)
    if (storeError) throw storeError
    
    let storeId
    if (stores && stores.length > 0) {
      storeId = stores[0].id
      console.log('Found existing store:', storeId)
    } else {
      const { data: newStore, error: insertStoreError } = await supabase.from('stores').insert({
        name: 'Main Admin Store',
        slug: 'main-admin-store',
        vat_rate: 0.14
      }).select().single()
      
      if (insertStoreError) throw insertStoreError
      storeId = newStore.id
      console.log('Created new store:', storeId)
    }

    // 2. Get or create a branch
    let { data: branches, error: branchError } = await supabase.from('branches').select('*').limit(1)
    if (branchError) throw branchError
    
    let branchId
    if (branches && branches.length > 0) {
      branchId = branches[0].id
      console.log('Found existing branch:', branchId)
    } else {
      const { data: newBranch, error: insertBranchError } = await supabase.from('branches').insert({
        store_id: storeId,
        name: 'Main Branch'
      }).select().single()
      
      if (insertBranchError) throw insertBranchError
      branchId = newBranch.id
      console.log('Created new branch:', branchId)
    }

    // 3. Upsert the profile
    const { data: profile, error: profileError } = await supabase.from('profiles').upsert({
      id: adminId,
      store_id: storeId,
      branch_id: branchId,
      full_name: 'System Admin',
      role: 'store_admin',
      is_active: true
    }).select()
    
    if (profileError) throw profileError
    
    console.log('Admin profile setup successful:', profile)

  } catch (err) {
    console.error('Error fixing admin:', err)
  }
}

fix()
