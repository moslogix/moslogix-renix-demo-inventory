'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import type { Supplier } from '@/types/database'
import { Plus, Pencil, Truck, Loader2, Mail, Phone } from 'lucide-react'

export default function SuppliersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<(Supplier & { product_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [formName, setFormName] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')

    if (error) { toast.error('Failed to load suppliers'); setLoading(false); return }

    // Count products per supplier
    const { data: products } = await supabase.from('products').select('supplier_id')
    const countMap = new Map<string, number>()
    products?.forEach((p: { supplier_id: string | null }) => {
      if (p.supplier_id) countMap.set(p.supplier_id, (countMap.get(p.supplier_id) ?? 0) + 1)
    })

    setSuppliers(((data as Supplier[]) ?? []).map(s => ({ ...s, product_count: countMap.get(s.id) ?? 0 })))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchSuppliers()
    async function getStore() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
        if (data?.store_id) setStoreId(data.store_id)
      }
    }
    getStore()
  }, [fetchSuppliers, supabase])

  function openAddModal() {
    setEditing(null)
    setFormName('')
    setFormContact('')
    setFormEmail('')
    setFormPhone('')
    setFormAddress('')
    setFormActive(true)
    setShowModal(true)
  }

  function openEditModal(sup: Supplier) {
    setEditing(sup)
    setFormName(sup.name)
    setFormContact(sup.contact_name || '')
    setFormEmail(sup.email || '')
    setFormPhone(sup.phone || '')
    setFormAddress(sup.address || '')
    setFormActive(sup.is_active)
    setShowModal(true)
  }

  async function handleSave() {
    if (!formName.trim()) { toast.error('Supplier name is required'); return }
    if (!storeId) { toast.error('Store not found'); return }
    setSaving(true)

    if (editing) {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: formName.trim(),
          contact_name: formContact || null,
          email: formEmail || null,
          phone: formPhone || null,
          address: formAddress || null,
          is_active: formActive,
        })
        .eq('id', editing.id)
      if (error) { toast.error('Failed to update'); setSaving(false); return }
      toast.success('Supplier updated')
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          store_id: storeId,
          name: formName.trim(),
          contact_name: formContact || null,
          email: formEmail || null,
          phone: formPhone || null,
          address: formAddress || null,
          is_active: formActive,
        })
      if (error) { toast.error('Failed to create: ' + error.message); setSaving(false); return }
      toast.success('Supplier created')
    }

    setSaving(false)
    setShowModal(false)
    fetchSuppliers()
  }

  const columns: Column<Supplier & { product_count: number }>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,114,243,0.08)', border: '1px solid rgba(99,114,243,0.15)' }}>
            <Truck size={14} className="text-brand-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">{row.name}</div>
            {row.contact_name && <div className="text-[11px] text-text-muted">{row.contact_name}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email ? (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <Mail size={11} /> {row.email}
        </div>
      ) : <span className="text-text-muted">—</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => row.phone ? (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <Phone size={11} /> {row.phone}
        </div>
      ) : <span className="text-text-muted">—</span>,
    },
    {
      key: 'product_count',
      header: 'Products',
      sortable: true,
      width: '90px',
      render: (row) => <span className="font-mono text-sm text-text-secondary">{row.product_count}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '80px',
      render: (row) => <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => openEditModal(row)} className="btn-icon"><Pencil size={13} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Suppliers</h1>
          <p className="text-sm text-text-muted mt-0.5">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus size={15} /> Add Supplier
        </button>
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        searchable
        searchPlaceholder="Search suppliers..."
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/inventory/suppliers/${row.id}`)}
        emptyMessage="No suppliers found"
      />

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Name *</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input-base" placeholder="Supplier name" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Contact Person</label>
            <input value={formContact} onChange={(e) => setFormContact(e.target.value)} className="input-base" placeholder="Contact name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email</label>
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="input-base" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Phone</label>
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="input-base" placeholder="+20 xxx xxx xxxx" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Address</label>
            <textarea value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="input-base" placeholder="Full address" rows={2} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setFormActive(!formActive)} className={`toggle-switch ${formActive ? 'active' : ''}`} />
            <span className="text-sm text-text-secondary">Active supplier</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
