'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Supplier, Product, PurchaseOrder } from '@/types/database'
import {
  ArrowLeft, Save, Loader2, Package, ClipboardList, TrendingUp,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function SupplierDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const supplierId = params.id as string

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit form
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isActive, setIsActive] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [supRes, prodsRes, poRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', supplierId).single(),
      supabase.from('products').select('*').eq('supplier_id', supplierId).order('name'),
      supabase.from('purchase_orders').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false }),
    ])

    if (supRes.error || !supRes.data) {
      toast.error('Supplier not found')
      router.push('/inventory/suppliers')
      return
    }

    const s = supRes.data
    setSupplier(s)
    setName(s.name)
    setContactName(s.contact_name || '')
    setEmail(s.email || '')
    setPhone(s.phone || '')
    setAddress(s.address || '')
    setIsActive(s.is_active)
    setProducts(prodsRes.data ?? [])
    setPurchaseOrders(poRes.data ?? [])
    setLoading(false)
  }, [supabase, supplierId, router])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('suppliers')
      .update({
        name: name.trim(),
        contact_name: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        is_active: isActive,
      })
      .eq('id', supplierId)

    if (error) { toast.error('Failed to save'); setSaving(false); return }
    toast.success('Supplier updated')
    setSaving(false)
    fetchData()
  }

  // Cost trend from purchase orders
  const costTrend = purchaseOrders
    .filter(po => po.status === 'received')
    .map(po => ({
      date: formatDateShort(po.created_at),
      total: po.total,
    }))
    .reverse()

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-[300px] rounded-xl" />
      </div>
    )
  }

  if (!supplier) return null

  const statusMap: Record<string, 'muted' | 'info' | 'brand' | 'warning' | 'success' | 'danger'> = {
    draft: 'muted',
    submitted: 'info',
    confirmed: 'brand',
    in_transit: 'warning',
    received: 'success',
    cancelled: 'danger',
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/inventory/suppliers')} className="btn-icon"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{supplier.name}</h1>
            <p className="text-sm text-text-muted">{products.length} products · {purchaseOrders.length} purchase orders</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="space-y-6">
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h2 className="text-sm font-semibold text-text-primary mb-4">Contact Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-base text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Contact Person</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-base text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-base text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="input-base text-sm" rows={2} />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setIsActive(!isActive)} className={`toggle-switch ${isActive ? 'active' : ''}`} />
                <span className="text-sm text-text-secondary">Active</span>
              </div>
            </div>
          </section>
        </div>

        {/* Products + POs */}
        <div className="col-span-2 space-y-6">
          {/* Cost trend chart */}
          {costTrend.length > 1 && (
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp size={14} /> Cost Trend
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={costTrend}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #253044', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#6272f3" strokeWidth={2} dot={{ fill: '#6272f3', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Products list */}
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Package size={14} /> Products ({products.length})
            </h3>
            {products.length === 0 ? (
              <p className="text-xs text-text-muted">No products from this supplier</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {products.map(p => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/inventory/products/${p.id}`)}
                    className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer hover:bg-bg-muted transition-colors"
                  >
                    <div>
                      <span className="text-sm text-text-primary">{p.name}</span>
                      {p.sku && <span className="text-[11px] text-text-muted ml-2 font-mono">{p.sku}</span>}
                    </div>
                    <span className="text-xs text-text-secondary">{formatCurrency(p.selling_price)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Purchase orders */}
          <section className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#0d1117' }}>
              <ClipboardList size={14} className="text-brand-400" />
              <h3 className="text-sm font-semibold text-text-primary">Purchase Orders ({purchaseOrders.length})</h3>
            </div>
            {purchaseOrders.length === 0 ? (
              <div className="p-5 text-xs text-text-muted" style={{ background: '#0d1117' }}>No purchase orders yet</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map(po => (
                    <tr key={po.id} onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)} className="cursor-pointer">
                      <td><span className="font-mono text-xs text-brand-300">{po.po_number}</span></td>
                      <td><span className="text-xs text-text-secondary">{formatDateShort(po.created_at)}</span></td>
                      <td><Badge variant={statusMap[po.status] || 'muted'}>{po.status.replace('_', ' ')}</Badge></td>
                      <td><span className="text-sm font-medium">{formatCurrency(po.total)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
