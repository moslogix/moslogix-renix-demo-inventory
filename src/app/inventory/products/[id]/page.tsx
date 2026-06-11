'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency, formatDate, calculateMargin, getMovementTypeColor, generateSKU } from '@/lib/utils'
import { StockBadge } from '@/components/ui/StockBadge'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { Product, ProductVariant, Category, Supplier, StockMovement, CurrentStock, TaxRule } from '@/types/database'
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Wand2,
  ArrowRightLeft, Package, TrendingUp,
} from 'lucide-react'

export default function ProductDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = params.id as string
  const initialTab = searchParams.get('tab') || 'details'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [stockByBranch, setStockByBranch] = useState<CurrentStock[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [movementPage, setMovementPage] = useState(0)
  const [hasMoreMovements, setHasMoreMovements] = useState(true)

  // Edit form
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [isTaxable, setIsTaxable] = useState(true)
  const [taxCategory, setTaxCategory] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')
  const [isActive, setIsActive] = useState(true)

  // Stock adjustment
  const [adjDelta, setAdjDelta] = useState('')
  const [adjReason, setAdjReason] = useState('count_correction')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjBranch, setAdjBranch] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // New variant modal
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [newVarName, setNewVarName] = useState('')
  const [newVarSku, setNewVarSku] = useState('')
  const [newVarPrice, setNewVarPrice] = useState('')

  const totalStock = stockByBranch.reduce((sum, s) => sum + Number(s.quantity ?? (s as any).quantity_on_hand ?? 0), 0)
  const margin = calculateMargin(parseFloat(sellingPrice) || 0, parseFloat(costPrice) || 0)

  const fetchProduct = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error || !data) {
      toast.error('Product not found')
      router.push('/inventory/products')
      return
    }

    setProduct(data)
    setName(data.name)
    setSku(data.sku || '')
    setBarcode(data.barcode || '')
    setDescription(data.description || '')
    setCategoryId(data.category_id || '')
    setSupplierId(data.supplier_id || '')
    setCostPrice(data.cost_price?.toString() || '')
    setSellingPrice(data.selling_price?.toString() || '0')
    setIsTaxable(data.is_taxable ?? true)
    setTaxCategory(data.tax_category || '')
    setLowStockThreshold(data.low_stock_threshold?.toString() || '10')
    setIsActive(data.is_active)
    setLoading(false)
  }, [supabase, productId, router])

  const fetchStock = useCallback(async () => {
    const { data } = await supabase
      .from('current_stock')
      .select('*')
      .eq('product_id', productId)
    setStockByBranch(data ?? [])
    if (data && data.length > 0 && !adjBranch) {
      setAdjBranch(data[0].branch_id)
    }
  }, [supabase, productId, adjBranch])

  const fetchMovements = useCallback(async (page = 0) => {
    const pageSize = 20
    const { data } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (page === 0) {
      setMovements(data ?? [])
    } else {
      setMovements(prev => [...prev, ...(data ?? [])])
    }
    setHasMoreMovements((data?.length ?? 0) === pageSize)
  }, [supabase, productId])

  const fetchVariants = useCallback(async () => {
    const { data } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('created_at')
    setVariants(data ?? [])
  }, [supabase, productId])

  useEffect(() => {
    async function fetchMeta() {
      const [catsRes, supsRes, taxRes, branchRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
        supabase.from('tax_rules').select('*').eq('is_active', true),
        supabase.from('branches').select('id, name').eq('is_active', true),
      ])
      setCategories(catsRes.data ?? [])
      setSuppliers(supsRes.data ?? [])
      setTaxRules(taxRes.data ?? [])
      const branchList = branchRes.data ?? []
      setBranches(branchList)
      if (branchList.length > 0 && !adjBranch) {
        setAdjBranch(branchList[0].id)
      }
    }
    fetchProduct()
    fetchStock()
    fetchMovements(0)
    fetchVariants()
    fetchMeta()
  }, [fetchProduct, fetchStock, fetchMovements, fetchVariants, supabase])

  // Realtime stock updates
  useEffect(() => {
    const channel = supabase
      .channel(`stock-${productId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements', filter: `product_id=eq.${productId}` }, () => {
        fetchStock()
        fetchMovements(0)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, productId, fetchStock, fetchMovements])

  async function handleSave() {
    if (!product) return
    setSaving(true)

    const { error } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        sku: sku || product.sku, // SKU is NOT NULL
        barcode: barcode || null,
        description: description || null,
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        selling_price: parseFloat(sellingPrice) || 0,
        cost_price: costPrice ? parseFloat(costPrice) : 0,
        is_taxable: isTaxable,
        tax_category: taxCategory || null,
        low_stock_threshold: parseInt(lowStockThreshold) || 10,
        is_active: isActive,
      } as any)
      .eq('id', product.id)

    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      toast.success('Product updated')
      fetchProduct()
    }
    setSaving(false)
  }

  async function handleStockAdjustment() {
    if (!product) return
    const delta = parseInt(adjDelta)
    if (isNaN(delta) || delta === 0) { toast.error('Enter a non-zero quantity'); return }
    if (!adjBranch) { toast.error('Select a branch'); return }

    setAdjusting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user!.id).single()

    const { error } = await supabase.from('stock_movements').insert({
      store_id: profile!.store_id!,
      product_id: product.id,
      branch_id: adjBranch,
      movement_type: 'adjustment',
      quantity: delta,
      notes: `[${adjReason}] ${adjNotes}`.trim(),
      created_by: user!.id,
    } as any)

    if (error) {
      toast.error('Failed to adjust stock: ' + error.message)
    } else {
      toast.success(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta}`)
      setAdjDelta('')
      setAdjNotes('')
      fetchStock()
      fetchMovements(0)
    }
    setAdjusting(false)
  }

  async function handleAddVariant() {
    if (!product || !newVarName.trim()) { toast.error('Variant name is required'); return }
    const { error } = await supabase.from('product_variants').insert({
      product_id: product.id,
      name: newVarName.trim(),
      sku: newVarSku || `VAR-${Date.now()}`,
      barcode: null,
      attributes: {},
      selling_price: newVarPrice ? parseFloat(newVarPrice) : null,
      cost_price: null,
      is_active: true,
    } as any)
    if (error) { toast.error('Failed to add variant'); return }
    toast.success('Variant added')
    setShowVariantModal(false)
    setNewVarName('')
    setNewVarSku('')
    setNewVarPrice('')
    fetchVariants()
  }

  async function handleDeleteVariant(id: string) {
    const { error } = await supabase.from('product_variants').delete().eq('id', id)
    if (error) { toast.error('Failed to delete variant'); return }
    toast.success('Variant removed')
    fetchVariants()
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-[400px] rounded-xl" />
      </div>
    )
  }

  if (!product) return null

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'movements', label: 'Stock Movements' },
    { id: 'variants', label: `Variants (${variants.length})` },
  ]

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/inventory/products')} className="btn-icon">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary">{product.name}</h1>
              <Badge variant={isActive ? 'success' : 'danger'}>{isActive ? 'Active' : 'Archived'}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1">
              {sku && <span className="text-xs text-text-muted font-mono">SKU: {sku}</span>}
              <StockBadge quantity={totalStock} threshold={parseInt(lowStockThreshold)} />
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Edit form */}
          <div className="col-span-2 space-y-6">
            {/* Basic Info */}
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h2 className="text-sm font-semibold text-text-primary mb-4">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-text-secondary mb-1">Product Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">SKU</label>
                  <div className="flex gap-2">
                    <input value={sku} onChange={(e) => setSku(e.target.value)} className="input-base" />
                    <button type="button" onClick={() => setSku(generateSKU())} className="btn-secondary shrink-0 text-xs px-3"><Wand2 size={12} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Barcode</label>
                  <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-base">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Supplier</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-base">
                    <option value="">None</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-text-secondary mb-1">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-base" rows={3} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <button type="button" onClick={() => setIsActive(!isActive)} className={`toggle-switch ${isActive ? 'active' : ''}`} />
                  <span className="text-sm text-text-secondary">Active product</span>
                </div>
              </div>
            </section>

            {/* Pricing */}
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h2 className="text-sm font-semibold text-text-primary mb-4">Pricing & Tax</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Cost (EGP)</label>
                  <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="input-base" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Selling (EGP)</label>
                  <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="input-base" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Margin</label>
                  <div className="input-base flex items-center" style={{ cursor: 'default' }}>
                    <span className={`font-mono text-sm font-medium ${margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsTaxable(!isTaxable)} className={`toggle-switch ${isTaxable ? 'active' : ''}`} />
                  <span className="text-sm text-text-secondary">Taxable</span>
                </div>
                {isTaxable && (
                  <select value={taxCategory} onChange={(e) => setTaxCategory(e.target.value)} className="input-base text-sm">
                    <option value="">Default VAT (14%)</option>
                    {taxRules.map(t => <option key={t.id} value={t.category}>{t.name} ({(t.rate * 100).toFixed(0)}%)</option>)}
                  </select>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-xs text-text-secondary mb-1">Low Stock Threshold</label>
                <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="input-base w-32" min="0" />
              </div>
            </section>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Stock by branch */}
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Package size={14} /> Stock by Branch
              </h3>
              {stockByBranch.length === 0 ? (
                <p className="text-xs text-text-muted">No stock recorded</p>
              ) : (
                <div className="space-y-2">
                  {stockByBranch.map(s => {
                    const branchName = branches.find(b => b.id === s.branch_id)?.name || s.branch_id
                    return (
                      <div key={s.branch_id} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0">
                        <span className="text-xs text-text-secondary">{branchName}</span>
                        <StockBadge quantity={Number(s.quantity ?? (s as any).quantity_on_hand ?? 0)} threshold={s.low_stock_threshold} />
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-2 mt-2" style={{ borderTop: '1px solid #253044' }}>
                    <span className="text-xs font-semibold text-text-primary">Total</span>
                    <span className="font-mono text-sm font-bold text-text-primary">{totalStock}</span>
                  </div>
                </div>
              )}
            </section>

            {/* Profit calculator */}
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Profit Calculator
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Cost Price</span>
                  <span className="text-text-secondary">{costPrice ? formatCurrency(parseFloat(costPrice)) : '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Selling Price</span>
                  <span className="text-text-primary font-medium">{formatCurrency(parseFloat(sellingPrice) || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Profit / Unit</span>
                  <span className="text-success font-medium">{costPrice ? formatCurrency((parseFloat(sellingPrice) || 0) - parseFloat(costPrice)) : '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Margin</span>
                  <span className={`font-medium ${margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}`}>{margin.toFixed(1)}%</span>
                </div>
                {isTaxable && (
                  <div className="flex justify-between text-xs pt-2" style={{ borderTop: '1px solid #1e293b' }}>
                    <span className="text-text-muted">VAT (14%)</span>
                    <span className="text-text-secondary">{formatCurrency((parseFloat(sellingPrice) || 0) * 0.14)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs pt-2" style={{ borderTop: '1px solid #1e293b' }}>
                  <span className="text-text-muted">Stock Value</span>
                  <span className="text-text-primary font-semibold">{costPrice ? formatCurrency(totalStock * parseFloat(costPrice)) : '—'}</span>
                </div>
              </div>
            </section>

            {/* Stock Adjustment */}
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <ArrowRightLeft size={14} /> Stock Adjustment
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Quantity (+/-)</label>
                  <input type="number" value={adjDelta} onChange={(e) => setAdjDelta(e.target.value)} className="input-base text-sm" placeholder="+10 or -5" />
                </div>
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Branch</label>
                  <select value={adjBranch} onChange={(e) => setAdjBranch(e.target.value)} className="input-base text-sm">
                    <option value="" disabled>Select branch...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Reason</label>
                  <select value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="input-base text-sm">
                    <option value="count_correction">Count Correction</option>
                    <option value="damaged">Damaged</option>
                    <option value="expired">Expired</option>
                    <option value="theft">Theft/Loss</option>
                    <option value="returned_to_supplier">Returned to Supplier</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Notes</label>
                  <input value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} className="input-base text-sm" placeholder="Optional notes" />
                </div>
                <button onClick={handleStockAdjustment} disabled={adjusting} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                  {adjusting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                  Apply Adjustment
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Notes</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-text-muted text-sm">No movements recorded</td>
                </tr>
              ) : (
                movements.map(m => {
                  const typeColor = getMovementTypeColor(m.movement_type)
                  return (
                    <tr key={m.id}>
                      <td><span className="text-xs text-text-secondary">{formatDate(m.created_at)}</span></td>
                      <td>
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded" style={{ color: typeColor.text, background: typeColor.bg }}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td>
                        <span className={`font-mono text-sm font-medium ${m.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </td>
                      <td><span className="text-xs text-text-muted">{m.notes || '—'}</span></td>
                      <td><span className="text-xs text-text-muted font-mono">{m.reference_id || '—'}</span></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {hasMoreMovements && movements.length > 0 && (
            <div className="flex justify-center py-3" style={{ borderTop: '1px solid #111827' }}>
              <button onClick={() => { setMovementPage(p => p + 1); fetchMovements(movementPage + 1) }} className="btn-ghost text-xs">
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'variants' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowVariantModal(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus size={14} /> Add Variant
            </button>
          </div>
          {variants.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <p className="text-sm text-text-muted">No variants. Add variants for sizes, colors, or other options.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Price Override</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map(v => (
                    <tr key={v.id}>
                      <td><span className="text-sm text-text-primary font-medium">{v.name}</span></td>
                      <td><span className="font-mono text-xs text-text-muted">{v.sku || '—'}</span></td>
                      <td><span className="text-sm">{v.selling_price ? formatCurrency(v.selling_price) : 'Same as product'}</span></td>
                      <td><Badge variant={v.is_active ? 'success' : 'danger'}>{v.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td>
                        <button onClick={() => handleDeleteVariant(v.id)} className="btn-icon">
                          <Trash2 size={13} className="text-danger" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Modal open={showVariantModal} onClose={() => setShowVariantModal(false)} title="Add Variant">
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Variant Name *</label>
                <input value={newVarName} onChange={(e) => setNewVarName(e.target.value)} className="input-base" placeholder="e.g. Large, Red" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">SKU</label>
                <input value={newVarSku} onChange={(e) => setNewVarSku(e.target.value)} className="input-base" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Price Override (EGP)</label>
                <input type="number" value={newVarPrice} onChange={(e) => setNewVarPrice(e.target.value)} className="input-base" placeholder="Leave empty for same price" min="0" step="0.01" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowVariantModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAddVariant} className="btn-primary">Add Variant</button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  )
}
