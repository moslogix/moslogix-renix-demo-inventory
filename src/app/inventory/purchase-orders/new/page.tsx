'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generatePONumber, formatCurrency } from '@/lib/utils'
import type { Supplier, Product } from '@/types/database'
import {
  ArrowLeft, Loader2, Plus, Trash2, Search, X,
} from 'lucide-react'

interface POLineItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_cost: number
}

export default function NewPurchaseOrderPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState('')

  const [supplierId, setSupplierId] = useState('')
  const [poNumber, setPoNumber] = useState(generatePONumber())
  const [notes, setNotes] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [branchId, setBranchId] = useState('')

  const [lineItems, setLineItems] = useState<POLineItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    async function init() {
      const [supsRes, branchRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
        supabase.from('branches').select('id, name').eq('is_active', true),
      ])
      setSuppliers(supsRes.data ?? [])
      const bl = branchRes.data ?? []
      setBranches(bl)
      if (bl.length > 0) setBranchId(bl[0].id)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
        if (data?.store_id) setStoreId(data.store_id)
      }
    }
    init()
  }, [supabase])

  useEffect(() => {
    async function searchProducts() {
      if (productSearch.length < 2) { setSearchResults([]); return }
      const { data } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%,barcode.ilike.%${productSearch}%`)
        .eq('is_active', true)
        .limit(10)
      setSearchResults(data ?? [])
    }
    const timer = setTimeout(searchProducts, 300)
    return () => clearTimeout(timer)
  }, [productSearch, supabase])

  function addProduct(product: Product) {
    if (lineItems.some(li => li.product_id === product.id)) {
      toast.error('Product already added')
      return
    }
    setLineItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_cost: product.cost_price ?? product.selling_price,
      },
    ])
    setProductSearch('')
    setSearchResults([])
    setShowSearch(false)
  }

  function updateLine(id: string, field: 'quantity' | 'unit_cost', value: number) {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li))
  }

  function removeLine(id: string) {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }

  const subtotal = lineItems.reduce((s, li) => s + (li.quantity * li.unit_cost), 0)
  const taxAmount = subtotal * 0.14
  const total = subtotal + taxAmount

  async function handleSubmit(asDraft: boolean) {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (lineItems.length === 0) { toast.error('Add at least one item'); return }
    if (!storeId) { toast.error('Store not found'); return }
    if (!branchId) { toast.error('Select a branch'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: po, error } = await supabase
      .from('purchase_orders')
      .insert({
        store_id: storeId,
        branch_id: branchId,
        supplier_id: supplierId,
        po_number: poNumber,
        order_number: poNumber,
        status: asDraft ? 'draft' : 'submitted',
        subtotal,
        tax_amount: taxAmount,
        total,
        total_cost: total,
        notes: notes || null,
        expected_date: expectedDate || null,
        expected_at: expectedDate ? new Date(expectedDate).toISOString() : null,
        received_date: null,
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (error) { toast.error('Failed to create PO: ' + error.message); setSaving(false); return }

    // Insert line items
    const items = lineItems.map(li => ({
      purchase_order_id: po.id,
      product_id: li.product_id,
      variant_id: null,
      quantity_ordered: li.quantity,
      quantity_received: 0,
      unit_cost: li.unit_cost,
      total_cost: li.quantity * li.unit_cost,
    }))

    const { error: itemsErr } = await supabase.from('purchase_order_items').insert(items)
    if (itemsErr) { toast.error('Items failed to save'); setSaving(false); return }

    toast.success(asDraft ? 'PO saved as draft' : 'PO submitted')
    router.push(`/inventory/purchase-orders/${po.id}`)
  }

  return (
    <div className="p-6 max-w-4xl animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="btn-icon"><ArrowLeft size={16} /></button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">New Purchase Order</h1>
          <p className="text-sm text-text-muted">Create a purchase order for your supplier</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* PO Info */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Order Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">PO Number</label>
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="input-base font-mono" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Supplier *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-base" required>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Branch *</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input-base">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Expected Date</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="input-base" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-base" rows={2} placeholder="Optional notes" />
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Items</h2>
            <div className="relative">
              <button onClick={() => setShowSearch(!showSearch)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Plus size={12} /> Add Item
              </button>
            </div>
          </div>

          {/* Product search */}
          {showSearch && (
            <div className="mb-4 relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="input-base pl-8 text-sm"
                  placeholder="Search products by name, SKU, or barcode..."
                  autoFocus
                />
                <button onClick={() => { setShowSearch(false); setProductSearch('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                  <X size={14} />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-48 overflow-y-auto" style={{ background: '#1a2332', border: '1px solid #253044' }}>
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-bg-subtle transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm text-text-primary">{p.name}</span>
                        {p.sku && <span className="text-[11px] text-text-muted ml-2 font-mono">{p.sku}</span>}
                      </div>
                      <span className="text-xs text-text-secondary">{formatCurrency(p.cost_price ?? p.selling_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {lineItems.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">No items added yet. Click &quot;Add Item&quot; to search for products.</p>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e293b' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: '100px' }}>Qty</th>
                    <th style={{ width: '120px' }}>Unit Cost</th>
                    <th style={{ width: '120px' }}>Total</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(li => (
                    <tr key={li.id}>
                      <td><span className="text-sm text-text-primary">{li.product_name}</span></td>
                      <td>
                        <input
                          type="number"
                          value={li.quantity}
                          onChange={(e) => updateLine(li.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="input-base text-sm py-1.5 w-20"
                          min="1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={li.unit_cost}
                          onChange={(e) => updateLine(li.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="input-base text-sm py-1.5 w-24"
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td><span className="text-sm font-medium">{formatCurrency(li.quantity * li.unit_cost)}</span></td>
                      <td>
                        <button onClick={() => removeLine(li.id)} className="btn-icon" style={{ width: 26, height: 26 }}>
                          <Trash2 size={12} className="text-danger" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Subtotal</span>
                  <span className="text-text-secondary">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">VAT (14%)</span>
                  <span className="text-text-secondary">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2" style={{ borderTop: '1px solid #1e293b' }}>
                  <span className="text-text-primary">Total</span>
                  <span className="text-text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={() => handleSubmit(true)} disabled={saving} className="btn-secondary flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save as Draft
          </button>
          <button onClick={() => handleSubmit(false)} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Submit PO
          </button>
        </div>
      </div>
    </div>
  )
}
