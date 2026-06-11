'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDate, getMovementTypeColor } from '@/lib/utils'
import { toast } from 'sonner'
import type { StockMovement } from '@/types/database'
import { ArrowRightLeft, Filter, Download } from 'lucide-react'

interface MovementRow extends StockMovement {
  product_name: string | null
  branch_name: string | null
  user_name: string | null
}

export default function MovementsPage() {
  const supabase = createClient()
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [filterType, setFilterType] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  const fetchMovements = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (filterType) query = query.eq('movement_type', filterType)
    if (filterProduct) query = query.eq('product_id', filterProduct)
    if (filterBranch) query = query.eq('branch_id', filterBranch)
    if (filterDateFrom) query = query.gte('created_at', filterDateFrom)
    if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59')

    const { data, error } = await query

    if (error) { toast.error('Failed to load movements'); setLoading(false); return }

    // Fetch names
    const productIds = Array.from(new Set<string>((data ?? []).map((m: any) => m.product_id)))
    const branchIds = Array.from(new Set<string>((data ?? []).map((m: any) => m.branch_id)))
    const userIds = Array.from(new Set<string>((data ?? []).map((m: any) => m.created_by).filter(Boolean)))

    const [prodsRes, branchesRes, usersRes] = await Promise.all([
      productIds.length > 0 ? supabase.from('products').select('id, name').in('id', productIds) : { data: [] },
      branchIds.length > 0 ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [] },
      userIds.length > 0 ? supabase.from('profiles').select('id, full_name').in('id', userIds as string[]) : { data: [] },
    ])

    const prodMap = new Map(prodsRes.data?.map((p: any) => [p.id, p.name]) ?? [])
    const branchMap = new Map(branchesRes.data?.map((b: any) => [b.id, b.name]) ?? [])
    const userMap = new Map(usersRes.data?.map((u: any) => [u.id, u.full_name]) ?? [])

    setMovements((data ?? []).map((m: any) => ({
      ...m,
      product_name: prodMap.get(m.product_id) ?? null,
      branch_name: branchMap.get(m.branch_id) ?? null,
      user_name: m.created_by ? userMap.get(m.created_by) ?? null : null,
    })))
    setLoading(false)
  }, [supabase, filterType, filterProduct, filterBranch, filterDateFrom, filterDateTo])

  useEffect(() => {
    fetchMovements()
    async function fetchMeta() {
      const [prodsRes, branchRes] = await Promise.all([
        supabase.from('products').select('id, name').order('name'),
        supabase.from('branches').select('id, name').eq('is_active', true),
      ])
      setProducts(prodsRes.data ?? [])
      setBranches(branchRes.data ?? [])
    }
    fetchMeta()
  }, [fetchMovements, supabase])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('movements-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements' }, () => {
        fetchMovements()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchMovements])

  function exportCSV() {
    const headers = ['Date', 'Product', 'Type', 'Quantity', 'Branch', 'Notes', 'User', 'Reference']
    const rows = movements.map(m => [
      new Date(m.created_at).toISOString(),
      m.product_name ?? '',
      m.movement_type,
      m.quantity.toString(),
      m.branch_name ?? '',
      m.notes ?? '',
      m.user_name ?? '',
      m.reference_id ?? '',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const columns: Column<MovementRow>[] = [
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      width: '160px',
      render: (row) => <span className="text-xs text-text-secondary">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'product_name',
      header: 'Product',
      sortable: true,
      render: (row) => <span className="text-sm text-text-primary">{row.product_name || '—'}</span>,
    },
    {
      key: 'movement_type',
      header: 'Type',
      width: '110px',
      render: (row) => {
        const c = getMovementTypeColor(row.movement_type)
        return (
          <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded" style={{ color: c.text, background: c.bg }}>
            {row.movement_type}
          </span>
        )
      },
    },
    {
      key: 'quantity',
      header: 'Quantity',
      sortable: true,
      width: '90px',
      render: (row) => (
        <span className={`font-mono text-sm font-medium ${row.quantity > 0 ? 'text-success' : 'text-danger'}`}>
          {row.quantity > 0 ? '+' : ''}{row.quantity}
        </span>
      ),
    },
    {
      key: 'branch_name',
      header: 'Branch',
      width: '120px',
      render: (row) => <span className="text-xs text-text-muted">{row.branch_name || '—'}</span>,
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => <span className="text-xs text-text-muted line-clamp-1 max-w-xs">{row.notes || '—'}</span>,
    },
    {
      key: 'user_name',
      header: 'User',
      width: '110px',
      render: (row) => <span className="text-xs text-text-muted">{row.user_name || '—'}</span>,
    },
    {
      key: 'reference_id',
      header: 'Ref',
      width: '80px',
      render: (row) => row.reference_id ? <span className="text-[10px] text-text-disabled font-mono">{row.reference_id.slice(0, 8)}</span> : <span className="text-text-disabled">—</span>,
    },
  ]

  const activeFilterCount = [filterType, filterProduct, filterBranch, filterDateFrom, filterDateTo].filter(Boolean).length

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <ArrowRightLeft size={20} /> Stock Movements
          </h1>
          <p className="text-sm text-text-muted mt-0.5">{movements.length} movements · Live updates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 text-xs py-2 px-3 ${activeFilterCount > 0 ? '!border-brand-500 !text-brand-300' : ''}`}
          >
            <Filter size={13} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-xs py-2 px-3">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-xl p-4 animate-fade-in" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Filters</span>
            <button onClick={() => { setFilterType(''); setFilterProduct(''); setFilterBranch(''); setFilterDateFrom(''); setFilterDateTo('') }} className="text-xs text-text-muted hover:text-text-primary">Clear all</button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-base py-2 text-xs">
                <option value="">All</option>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="return">Return</option>
                <option value="adjustment">Adjustment</option>
                <option value="transfer">Transfer</option>
                <option value="initial">Initial</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Product</label>
              <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="input-base py-2 text-xs">
                <option value="">All</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Branch</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="input-base py-2 text-xs">
                <option value="">All</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
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
        data={movements}
        loading={loading}
        searchable
        searchPlaceholder="Search movements..."
        rowKey={(row) => row.id}
        emptyMessage="No stock movements found"
      />
    </div>
  )
}
