'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency, formatDate, formatDateShort } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { PurchaseOrder, PurchaseOrderItem, Product, Supplier } from '@/types/database'
import {
  ArrowLeft, Loader2, Send, Check, Truck as TruckIcon, PackageCheck,
  X,
} from 'lucide-react'

const statusVariant: Record<string, 'muted' | 'info' | 'brand' | 'warning' | 'success' | 'danger'> = {
  draft: 'muted',
  submitted: 'info',
  confirmed: 'brand',
  in_transit: 'warning',
  received: 'success',
  cancelled: 'danger',
}

const statusFlow: Record<string, { next: string; label: string; icon: React.ReactNode }> = {
  draft: { next: 'submitted', label: 'Submit', icon: <Send size={14} /> },
  submitted: { next: 'confirmed', label: 'Confirm', icon: <Check size={14} /> },
  confirmed: { next: 'in_transit', label: 'Mark In Transit', icon: <TruckIcon size={14} /> },
  in_transit: { next: 'received', label: 'Receive', icon: <PackageCheck size={14} /> },
}

type POItem = PurchaseOrderItem & { product?: Product }

export default function PurchaseOrderDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const poId = params.id as string

  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [items, setItems] = useState<POItem[]>([])
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [receiveMode, setReceiveMode] = useState(false)
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)

    const { data: poData, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single()

    if (error || !poData) {
      toast.error('Purchase order not found')
      router.push('/inventory/purchase-orders')
      return
    }

    setPo(poData)

    const [supRes, itemsRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', poData.supplier_id).single(),
      supabase.from('purchase_order_items').select('*').eq('purchase_order_id', poId),
    ])

    setSupplier(supRes.data)

    // Fetch product details for each item
    const poItems: any[] = itemsRes.data ?? []
    const productIds = poItems.map((i: any) => i.product_id)
    const { data: products } = await supabase.from('products').select('*').in('id', productIds)
    const productMap = new Map((products as any[])?.map((p: any) => [p.id, p]) ?? [])

    const enrichedItems = poItems.map((i: any) => ({
      ...i,
      product: productMap.get(i.product_id),
    }))
    setItems(enrichedItems)

    // Init received quantities
    const qtyMap: Record<string, number> = {}
    enrichedItems.forEach((i: any) => {
      qtyMap[i.id] = i.quantity_received || i.quantity_ordered
    })
    setReceivedQtys(qtyMap)

    setLoading(false)
  }, [supabase, poId, router])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleStatusChange(newStatus: string) {
    if (!po) return
    setUpdating(true)

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'received') {
      updateData.received_date = new Date().toISOString()
    }

    const { error } = await supabase
      .from('purchase_orders')
      .update(updateData as any)
      .eq('id', po.id)

    if (error) { toast.error('Failed to update status'); setUpdating(false); return }
    toast.success(`Status updated to ${newStatus.replace('_', ' ')}`)
    setUpdating(false)
    fetchData()
  }

  async function handleReceive() {
    if (!po) return
    setUpdating(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user!.id).single()

    // Update each item's quantity_received
    for (const item of items) {
      const qty = receivedQtys[item.id] ?? item.quantity_ordered
      await supabase
        .from('purchase_order_items')
        .update({ quantity_received: qty } as any)
        .eq('id', item.id)

      // Insert stock movement for received quantity
      if (qty > 0) {
        await supabase.from('stock_movements').insert({
          store_id: profile!.store_id!,
          product_id: item.product_id,
          branch_id: po.branch_id!,
          movement_type: 'purchase',
          quantity: qty,
          reference_id: po.id,
          notes: `Received from PO ${po.po_number}`,
          created_by: user!.id,
        } as any)
      }
    }

    // Update PO status
    await supabase
      .from('purchase_orders')
      .update({ status: 'received', received_date: new Date().toISOString() } as any)
      .eq('id', po.id)

    toast.success('Purchase order received — stock updated')
    setUpdating(false)
    setReceiveMode(false)
    fetchData()
  }

  async function handleCancel() {
    if (!po) return
    setUpdating(true)
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled' } as any)
      .eq('id', po.id)
    if (error) { toast.error('Failed to cancel'); setUpdating(false); return }
    toast.success('Purchase order cancelled')
    setUpdating(false)
    fetchData()
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-[400px] rounded-xl" />
      </div>
    )
  }

  if (!po) return null

  const nextAction = statusFlow[po.status]
  const isReceivable = po.status === 'in_transit'
  const isTerminal = po.status === 'received' || po.status === 'cancelled'

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/inventory/purchase-orders')} className="btn-icon"><ArrowLeft size={16} /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary font-mono">{po.po_number}</h1>
              <Badge variant={statusVariant[po.status]} size="md">{po.status.replace('_', ' ')}</Badge>
            </div>
            <p className="text-sm text-text-muted mt-0.5">
              Created {formatDate(po.created_at)}
              {po.expected_date && <> · Expected {formatDateShort(po.expected_date)}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && po.status !== 'in_transit' && nextAction && (
            <button onClick={() => handleStatusChange(nextAction.next)} disabled={updating} className="btn-primary flex items-center gap-2 text-sm">
              {updating ? <Loader2 size={14} className="animate-spin" /> : nextAction.icon}
              {nextAction.label}
            </button>
          )}
          {isReceivable && !receiveMode && (
            <button onClick={() => setReceiveMode(true)} className="btn-primary flex items-center gap-2 text-sm">
              <PackageCheck size={14} /> Receive Items
            </button>
          )}
          {!isTerminal && (
            <button onClick={handleCancel} disabled={updating} className="btn-danger text-sm flex items-center gap-2">
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Items */}
        <div className="col-span-2">
          <section className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#0d1117' }}>
              <h2 className="text-sm font-semibold text-text-primary">Line Items</h2>
              {receiveMode && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setReceiveMode(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                  <button onClick={handleReceive} disabled={updating} className="btn-primary text-xs py-1 px-3 flex items-center gap-1.5">
                    {updating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Confirm Receipt
                  </button>
                </div>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: '100px' }}>Ordered</th>
                  {(receiveMode || po.status === 'received') && <th style={{ width: '120px' }}>Received</th>}
                  <th style={{ width: '100px' }}>Unit Cost</th>
                  <th style={{ width: '110px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <span className="text-sm text-text-primary">{item.product?.name ?? 'Unknown'}</span>
                        {item.product?.sku && <span className="text-[11px] text-text-muted ml-2 font-mono">{item.product.sku}</span>}
                      </div>
                    </td>
                    <td><span className="font-mono text-sm">{item.quantity_ordered}</span></td>
                    {(receiveMode || po.status === 'received') && (
                      <td>
                        {receiveMode ? (
                          <input
                            type="number"
                            value={receivedQtys[item.id] ?? item.quantity_ordered}
                            onChange={(e) => setReceivedQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                            className="input-base text-sm py-1.5 w-20"
                            min="0"
                            max={item.quantity_ordered}
                          />
                        ) : (
                          <span className={`font-mono text-sm ${item.quantity_received < item.quantity_ordered ? 'text-warning' : 'text-success'}`}>
                            {item.quantity_received}
                          </span>
                        )}
                      </td>
                    )}
                    <td><span className="text-xs text-text-secondary">{formatCurrency(item.unit_cost)}</span></td>
                    <td><span className="text-sm font-medium">{formatCurrency(item.total_cost)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="px-5 py-4 flex justify-end" style={{ background: '#0d1117', borderTop: '1px solid #1e293b' }}>
              <div className="w-56 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Subtotal</span>
                  <span>{formatCurrency(po.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Tax</span>
                  <span>{formatCurrency(po.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: '1px solid #1e293b' }}>
                  <span className="text-text-primary">Total</span>
                  <span className="text-text-primary">{formatCurrency(po.total)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Info */}
        <div className="space-y-6">
          {/* Supplier card */}
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Supplier</h3>
            {supplier ? (
              <div className="space-y-2">
                <p className="text-sm text-text-primary font-medium">{supplier.name}</p>
                {supplier.contact_name && <p className="text-xs text-text-muted">{supplier.contact_name}</p>}
                {supplier.email && <p className="text-xs text-text-secondary">{supplier.email}</p>}
                {supplier.phone && <p className="text-xs text-text-secondary">{supplier.phone}</p>}
              </div>
            ) : (
              <p className="text-xs text-text-muted">Supplier not found</p>
            )}
          </section>

          {/* Status timeline */}
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Status Timeline</h3>
            <div className="space-y-3">
              {['draft', 'submitted', 'confirmed', 'in_transit', 'received'].map((status, i) => {
                const statusOrder = ['draft', 'submitted', 'confirmed', 'in_transit', 'received']
                const currentIdx = statusOrder.indexOf(po.status)
                const thisIdx = i
                const isPast = thisIdx <= currentIdx
                const isCurrent = status === po.status

                return (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{
                        background: isPast ? '#6272f3' : '#1a2332',
                        color: isPast ? '#fff' : '#475569',
                        border: `2px solid ${isCurrent ? '#6272f3' : isPast ? '#6272f3' : '#253044'}`,
                      }}
                    >
                      {isPast ? <Check size={10} /> : i + 1}
                    </div>
                    <span className={`text-xs capitalize ${isCurrent ? 'text-brand-300 font-semibold' : isPast ? 'text-text-secondary' : 'text-text-disabled'}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                )
              })}
              {po.status === 'cancelled' && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-danger/20 text-danger text-[10px] font-bold" style={{ border: '2px solid rgba(239,68,68,0.4)' }}>
                    <X size={10} />
                  </div>
                  <span className="text-xs text-danger font-semibold">Cancelled</span>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          {po.notes && (
            <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Notes</h3>
              <p className="text-xs text-text-secondary whitespace-pre-wrap">{po.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
