'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { toast } from 'sonner'
import type { PurchaseOrder, Supplier } from '@/types/database'
import { Plus, Filter } from 'lucide-react'

type PORow = PurchaseOrder & { supplier_name: string | null }

const statusVariant: Record<string, 'muted' | 'info' | 'brand' | 'warning' | 'success' | 'danger'> = {
  draft: 'muted',
  submitted: 'info',
  confirmed: 'brand',
  in_transit: 'warning',
  received: 'success',
  cancelled: 'danger',
}

export default function PurchaseOrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<PORow[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterSupplier) query = query.eq('supplier_id', filterSupplier)
    if (filterDateFrom) query = query.gte('created_at', filterDateFrom)
    if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59')

    const { data, error } = await query

    if (error) { toast.error('Failed to load purchase orders'); setLoading(false); return }

    // Fetch supplier names
    const { data: sups } = await supabase.from('suppliers').select('id, name')
    const supMap = new Map((sups as any[])?.map((s: any) => [s.id, s.name]) ?? [])

    setOrders((data ?? []).map((po: any) => ({
      ...po,
      supplier_name: supMap.get(po.supplier_id) ?? null,
    })))
    setLoading(false)
  }, [supabase, filterStatus, filterSupplier, filterDateFrom, filterDateTo])

  useEffect(() => {
    fetchOrders()
    async function fetchSups() {
      const { data } = await supabase.from('suppliers').select('*').order('name')
      setSuppliers(data ?? [])
    }
    fetchSups()
  }, [fetchOrders, supabase])

  const columns: Column<PORow>[] = [
    {
      key: 'po_number',
      header: 'PO Number',
      sortable: true,
      width: '140px',
      render: (row) => (
        <span className="font-mono text-xs text-brand-300 font-medium">{row.po_number}</span>
      ),
    },
    {
      key: 'supplier_name',
      header: 'Supplier',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-text-primary">{row.supplier_name || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row) => (
        <Badge variant={statusVariant[row.status] || 'muted'}>
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      width: '120px',
      render: (row) => (
        <span className="text-sm font-medium text-text-primary">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'expected_date',
      header: 'Expected',
      width: '110px',
      render: (row) => (
        <span className="text-xs text-text-secondary">{row.expected_date ? formatDateShort(row.expected_date) : '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      width: '110px',
      render: (row) => (
        <span className="text-xs text-text-muted">{formatDateShort(row.created_at)}</span>
      ),
    },
  ]

  const activeFilterCount = [filterStatus, filterSupplier, filterDateFrom, filterDateTo].filter(Boolean).length

  // KPIs
  const totalValue = orders.reduce((s, o) => s + o.total, 0)
  const draftCount = orders.filter(o => o.status === 'draft').length
  const pendingCount = orders.filter(o => ['submitted', 'confirmed', 'in_transit'].includes(o.status)).length

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Purchase Orders</h1>
          <p className="text-sm text-text-muted mt-0.5">{orders.length} orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 text-xs py-2 px-3 ${activeFilterCount > 0 ? '!border-brand-500 !text-brand-300' : ''}`}
          >
            <Filter size={13} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button onClick={() => router.push('/inventory/purchase-orders/new')} className="btn-primary flex items-center gap-2 text-sm py-2">
            <Plus size={15} /> New PO
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Value', value: formatCurrency(totalValue), icon: '💰' },
          { label: 'Drafts', value: draftCount.toString(), icon: '📝' },
          { label: 'In Progress', value: pendingCount.toString(), icon: '🚚' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <span className="text-2xl">{kpi.icon}</span>
            <div>
              <div className="text-lg font-bold text-text-primary">{kpi.value}</div>
              <div className="text-[11px] text-text-muted uppercase tracking-wide">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl p-4 animate-fade-in" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Filters</span>
            <button onClick={() => { setFilterStatus(''); setFilterSupplier(''); setFilterDateFrom(''); setFilterDateTo('') }} className="text-xs text-text-muted hover:text-text-primary">Clear all</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-base py-2 text-xs">
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_transit">In Transit</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Supplier</label>
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="input-base py-2 text-xs">
                <option value="">All</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">From</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="input-base py-2 text-xs" />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">To</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="input-base py-2 text-xs" />
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        searchable
        searchPlaceholder="Search by PO number..."
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/inventory/purchase-orders/${row.id}`)}
        emptyMessage="No purchase orders found"
      />
    </div>
  )
}
