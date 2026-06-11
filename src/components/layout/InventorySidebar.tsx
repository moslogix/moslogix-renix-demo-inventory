'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Package,
  FolderTree,
  Truck,
  ClipboardList,
  ArrowRightLeft,
  BarChart3,
  ScanBarcode,
  LogOut,
  ChevronRight,
  Zap,
} from 'lucide-react'

const navItems = [
  { label: 'Products', href: '/inventory/products', icon: Package },
  { label: 'Categories', href: '/inventory/categories', icon: FolderTree },
  { label: 'Suppliers', href: '/inventory/suppliers', icon: Truck },
  { label: 'Purchase Orders', href: '/inventory/purchase-orders', icon: ClipboardList },
  { label: 'Stock Movements', href: '/inventory/movements', icon: ArrowRightLeft },
  { label: 'Barcodes', href: '/inventory/barcodes', icon: ScanBarcode },
  { label: 'Intelligence', href: '/inventory/intelligence', icon: BarChart3 },
]

interface InventorySidebarProps {
  userEmail: string
  userRole: string
}

export function InventorySidebar({ userEmail, userRole }: InventorySidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/inventory/products') {
      return pathname === href || pathname.startsWith('/inventory/products/')
    }
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col w-60 shrink-0 h-screen sticky top-0 overflow-y-auto"
      style={{ background: '#080b14', borderRight: '1px solid #1e293b' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border-dim">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f56e7, #6272f3)' }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary leading-none">MOS Logix</div>
            <div className="text-xs text-text-muted mt-0.5">Inventory</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group"
              style={{
                background: active ? 'rgba(99,114,243,0.12)' : 'transparent',
                color: active ? '#a5bbfc' : '#64748b',
                borderLeft: active ? '3px solid #6272f3' : '3px solid transparent',
              }}
            >
              <Icon
                size={16}
                className="shrink-0 transition-colors"
                style={{ color: active ? '#6272f3' : '#475569' }}
              />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={12} className="text-brand-500 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border-dim">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
          style={{ background: '#0d1117' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f56e7, #6272f3)' }}
          >
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-text-primary truncate">{userEmail}</div>
            <div className="text-[10px] text-text-muted capitalize">{userRole}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-text-muted hover:text-danger hover:bg-danger/5 transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
