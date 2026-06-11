'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StockBadge } from '@/components/ui/StockBadge'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import type { Product, Category, Supplier, CurrentStock } from '@/types/database'
import {
  Plus,
  Filter,
  Pencil,
  Archive,
  ArrowRightLeft,
  Tag,
  DollarSign,
  Power,
  X,
} from 'lucide-react'

interface ProductRow extends Product {
  category_name: string | null
  supplier_name: string | null
  total_stock: number
  is_low_stock: boolean
}

export default function ProductsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterStockStatus, setFilterStockStatus] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Bulk modals
  const [bulkPriceModal, setBulkPriceModal] = useState(false)
  const [bulkCategoryModal, setBulkCategoryModal] = useState(false)
  const [bulkPriceValue, setBulkPriceValue] = useState('')
  const [bulkPriceField, setBulkPriceField] = useState<'selling_price' | 'cost_price'>('selling_price')
  const [bulkCategoryValue, setBulkCategoryValue] = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)

    const applyStockFilter = (rows: ProductRow[]) => {
      let filtered = rows
      if (filterStockStatus === 'in_stock') {
        filtered = rows.filter(p => p.total_stock > p.low_stock_threshold)
      } else if (filterStockStatus === 'low') {
        filtered = rows.filter(p => p.total_stock > 0 && p.total_stock <= p.low_stock_threshold)
      } else if (filterStockStatus === 'out') {
        filtered = rows.filter(p => p.total_stock <= 0)
      }
      setProducts(filtered)
      setLoading(false)
    }

    // Fetch products with category and supplier names
    let query = supabase
      .from('products')
      .select('*, categories!products_category_id_fkey(name), suppliers!products_supplier_id_fkey(name)')
      .order('created_at', { ascending: false })

    if (filterCategory) query = query.eq('category_id', filterCategory)
    if (filterSupplier) query = query.eq('supplier_id', filterSupplier)
    if (filterActive === 'active') query = query.eq('is_active', true)
    if (filterActive === 'inactive') query = query.eq('is_active', false)

    const { data: productsData, error } = await query

    if (error) {
      // Fallback: fetch without joins if foreign key naming differs
      const { data: fallbackData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (fallbackData) {
        // Fetch stock separately
        const { data: stockData } = await supabase.from('current_stock').select('*')
        const stockMap = new Map<string, { qty: number; isLow: boolean }>()
        stockData?.forEach((s: CurrentStock) => {
          const existing = stockMap.get(s.product_id)
          stockMap.set(s.product_id, {
            qty: (existing?.qty ?? 0) + Number(s.quantity ?? (s as any).quantity_on_hand ?? 0),
            isLow: s.is_low_stock || (existing?.isLow ?? false),
          })
        })

        // Fetch categories and suppliers for name lookup
        const { data: catsData } = await supabase.from('categories').select('id, name') as any
        const { data: supData } = await supabase.from('suppliers').select('id, name') as any
        const catMap = new Map((catsData as any[])?.map((c: any) => [c.id, c.name]) ?? [])
        const supMap = new Map((supData as any[])?.map((s: any) => [s.id, s.name]) ?? [])

        const rows = fallbackData.map((p: Product) => {
          const stock = stockMap.get(p.id)
          return {
            ...p,
            category_name: p.category_id ? catMap.get(p.category_id) ?? null : null,
            supplier_name: p.supplier_id ? supMap.get(p.supplier_id) ?? null : null,
            total_stock: stock?.qty ?? 0,
            is_low_stock: stock?.isLow ?? false,
          } as ProductRow
        })

        applyStockFilter(rows)
        return
      }
      toast.error('Failed to load products')
      setLoading(false)
      return
    }

    // Fetch all stock levels from current_stock VIEW
    const { data: stockData } = await supabase.from('current_stock').select('*')
    const stockMap = new Map<string, { qty: number; isLow: boolean }>()
    stockData?.forEach((s: CurrentStock) => {
      const existing = stockMap.get(s.product_id)
      stockMap.set(s.product_id, {
        qty: (existing?.qty ?? 0) + Number(s.quantity ?? (s as any).quantity_on_hand ?? 0),
        isLow: s.is_low_stock || (existing?.isLow ?? false),
      })
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: ProductRow[] = (productsData ?? []).map((p: any) => ({
      ...p,
      category_name: p.categories?.name ?? null,
      supplier_name: p.suppliers?.name ?? null,
      total_stock: stockMap.get(p.id)?.qty ?? 0,
      is_low_stock: stockMap.get(p.id)?.isLow ?? false,
    }))

    applyStockFilter(rows)
  }, [supabase, filterCategory, filterSupplier, filterActive, filterStockStatus])


  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Fetch categories and suppliers for filters
  useEffect(() => {
    async function fetchMeta() {
      const [cats, sups] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
      ])
      setCategories(cats.data ?? [])
      setSuppliers(sups.data ?? [])
    }
    fetchMeta()
  }, [supabase])

  // Realtime subscription for stock_movements
  useEffect(() => {
    const channel = supabase
      .channel('stock-movements-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements' }, () => {
        fetchProducts()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchProducts])

  // Bulk operations
  async function handleBulkActivate(activate: boolean) {
    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('products')
      .update({ is_active: activate } as any)
      .in('id', ids)

    if (error) { toast.error('Failed to update products'); return }
    toast.success(`${ids.length} products ${activate ? 'activated' : 'deactivated'}`)
    setSelectedIds(new Set())
    fetchProducts()
  }

  async function handleBulkPriceUpdate() {
    const val = parseFloat(bulkPriceValue)
    if (isNaN(val) || val < 0) { toast.error('Invalid price'); return }
    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('products')
      .update({ [bulkPriceField]: val } as any)
      .in('id', ids)

    if (error) { toast.error('Failed to update prices'); return }
    toast.success(`Updated ${bulkPriceField === 'selling_price' ? 'selling' : 'cost'} price for ${ids.length} products`)
    setBulkPriceModal(false)
    setBulkPriceValue('')
    setSelectedIds(new Set())
    fetchProducts()
  }

  async function handleBulkCategoryUpdate() {
    if (!bulkCategoryValue) { toast.error('Select a category'); return }
    const ids = Array.from(selectedIds)
    const { error } = await supabase
      .from('products')
      .update({ category_id: bulkCategoryValue } as any)
      .in('id', ids)

    if (error) { toast.error('Failed to update categories'); return }
    toast.success(`Updated category for ${ids.length} products`)
    setBulkCategoryModal(false)
    setBulkCategoryValue('')
    setSelectedIds(new Set())
    fetchProducts()
  }

  async function handleArchive(product: ProductRow) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active } as any)
      .eq('id', product.id)

    if (error) { toast.error('Failed to update product'); return }
    toast.success(product.is_active ? 'Product archived' : 'Product activated')
    fetchProducts()
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '100px',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-text-secondary">{row.sku || '—'}</span>
      ),
    },
    {
      key: 'barcode',
      header: 'Barcode',
      width: '120px',
      render: (row) => (
        <span className="font-mono text-xs text-text-muted">{row.barcode || '—'}</span>
      ),
    },
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.images && row.images.length > 0 ? (
            <img src={row.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" style={{ border: '1px solid #253044' }} />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a2332', border: '1px solid #253044' }}>
              <Tag size={12} className="text-text-muted" />
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-text-primary">{row.name}</div>
            {row.category_name && (
              <div className="text-[11px] text-text-muted">{row.category_name}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'cost_price',
      header: 'Cost',
      sortable: true,
      width: '100px',
      render: (row) => (
        <span className="text-xs text-text-secondary">{row.cost_price ? formatCurrency(row.cost_price) : '—'}</span>
      ),
    },
    {
      key: 'selling_price',
      header: 'Selling',
      sortable: true,
      width: '100px',
      render: (row) => (
        <span className="text-sm font-medium text-text-primary">{formatCurrency(row.selling_price)}</span>
      ),
    },
    {
      key: 'total_stock',
      header: 'Stock',
      sortable: true,
      width: '140px',
      render: (row) => <StockBadge quantity={row.total_stock} threshold={row.low_stock_threshold} />,
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/inventory/products/${row.id}`)}
            className="btn-icon"
            data-tooltip="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleArchive(row)}
            className="btn-icon"
            data-tooltip={row.is_active ? 'Archive' : 'Activate'}
          >
            <Archive size={13} />
          </button>
          <button
            onClick={() => router.push(`/inventory/products/${row.id}?tab=movements`)}
            className="btn-icon"
            data-tooltip="Movements"
          >
            <ArrowRightLeft size={13} />
          </button>
        </div>
      ),
    },
  ]

  const activeFilterCount = [filterCategory, filterSupplier, filterStockStatus, filterActive].filter(Boolean).length

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Product Catalog</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} in inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 text-xs py-2 px-3 ${activeFilterCount > 0 ? '!border-brand-500 !text-brand-300' : ''}`}
          >
            <Filter size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#6272f3', color: '#fff' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push('/inventory/products/new')}
            className="btn-primary flex items-center gap-2 text-sm py-2"
          >
            <Plus size={15} />
            Add Product
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl p-4 animate-fade-in" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Filters</span>
            <button
              onClick={() => {
                setFilterCategory('')
                setFilterSupplier('')
                setFilterStockStatus('')
                setFilterActive('')
              }}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="input-base py-2 text-xs"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Supplier</label>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="input-base py-2 text-xs"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Stock Status</label>
              <select
                value={filterStockStatus}
                onChange={(e) => setFilterStockStatus(e.target.value)}
                className="input-base py-2 text-xs"
              >
                <option value="">All</option>
                <option value="in_stock">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Status</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="input-base py-2 text-xs"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Archived</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        searchable
        searchPlaceholder="Search by name, SKU, or barcode..."
        rowKey={(row) => row.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(row) => router.push(`/inventory/products/${row.id}`)}
        toolbar={
          selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setBulkPriceModal(true)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <DollarSign size={12} /> Update Price
              </button>
              <button onClick={() => setBulkCategoryModal(true)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Tag size={12} /> Change Category
              </button>
              <button onClick={() => handleBulkActivate(true)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Power size={12} /> Activate
              </button>
              <button onClick={() => handleBulkActivate(false)} className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5">
                <X size={12} /> Deactivate
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Bulk Price Modal */}
      <Modal open={bulkPriceModal} onClose={() => setBulkPriceModal(false)} title="Bulk Price Update">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">Update price for {selectedIds.size} selected products.</p>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Price Field</label>
            <select value={bulkPriceField} onChange={(e) => setBulkPriceField(e.target.value as 'selling_price' | 'cost_price')} className="input-base text-sm">
              <option value="selling_price">Selling Price</option>
              <option value="cost_price">Cost Price</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">New Price (EGP)</label>
            <input type="number" value={bulkPriceValue} onChange={(e) => setBulkPriceValue(e.target.value)} className="input-base text-sm" placeholder="0.00" min="0" step="0.01" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setBulkPriceModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleBulkPriceUpdate} className="btn-primary text-sm">Update All</button>
          </div>
        </div>
      </Modal>

      {/* Bulk Category Modal */}
      <Modal open={bulkCategoryModal} onClose={() => setBulkCategoryModal(false)} title="Change Category">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">Change category for {selectedIds.size} selected products.</p>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Category</label>
            <select value={bulkCategoryValue} onChange={(e) => setBulkCategoryValue(e.target.value)} className="input-base text-sm">
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setBulkCategoryModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleBulkCategoryUpdate} className="btn-primary text-sm">Update All</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
