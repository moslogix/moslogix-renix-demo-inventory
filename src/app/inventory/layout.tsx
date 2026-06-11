import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InventorySidebar } from '@/components/layout/InventorySidebar'
import { ReconnectBanner } from '@/components/layout/ReconnectBanner'

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      <ReconnectBanner />
      <InventorySidebar
        userEmail={user.email ?? ''}
        userRole={profile?.role ?? 'inventory_staff'}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
