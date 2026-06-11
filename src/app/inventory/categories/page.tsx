'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { slugify } from '@/lib/utils'
import type { Category, CategoryNode } from '@/types/database'
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  FolderTree, GripVertical, AlertTriangle, Loader2,
} from 'lucide-react'

function buildTree(categories: (Category & { product_count: number })[], parentId: string | null = null): CategoryNode[] {
  return categories
    .filter(c => c.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({
      ...c,
      children: buildTree(categories, c.id),
    }))
}

interface TreeNodeProps {
  node: CategoryNode
  depth: number
  onEdit: (cat: CategoryNode) => void
  onDelete: (cat: CategoryNode) => void
  onAddChild: (parentId: string) => void
}

function TreeNode({ node, depth, onEdit, onDelete, onAddChild }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2.5 px-3 rounded-lg group transition-colors hover:bg-bg-muted"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <GripVertical size={14} className="text-text-disabled opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className="w-5 h-5 flex items-center justify-center shrink-0"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-border" />
          )}
        </button>
        <FolderTree size={14} className="text-brand-400 shrink-0" />
        <span className="text-sm text-text-primary font-medium flex-1">{node.name}</span>
        <span className="text-[11px] text-text-muted font-mono mr-2">
          {node.product_count} product{node.product_count !== 1 ? 's' : ''}
        </span>
        <Badge variant={node.is_active ? 'success' : 'danger'} size="sm">
          {node.is_active ? 'Active' : 'Inactive'}
        </Badge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <button onClick={() => onAddChild(node.id)} className="btn-icon" style={{ width: 26, height: 26 }}>
            <Plus size={12} />
          </button>
          <button onClick={() => onEdit(node)} className="btn-icon" style={{ width: 26, height: 26 }}>
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(node)} className="btn-icon" style={{ width: 26, height: 26 }}>
            <Trash2 size={12} className="text-danger" />
          </button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddChild={onAddChild} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CategoriesPage() {
  const supabase = createClient()
  const [tree, setTree] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [catName, setCatName] = useState('')
  const [catSlug, setCatSlug] = useState('')
  const [catActive, setCatActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingCat, setDeletingCat] = useState<CategoryNode | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    const { data: cats, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order') as any

    if (error) { toast.error('Failed to load categories'); setLoading(false); return }

    // Get product counts per category
    const { data: products } = await supabase
      .from('products')
      .select('category_id') as any

    const countMap = new Map<string, number>()
    products?.forEach((p: { category_id: string | null }) => {
      if (p.category_id) {
        countMap.set(p.category_id, (countMap.get(p.category_id) ?? 0) + 1)
      }
    })

    const catsWithCount = ((cats as Category[]) ?? []).map(c => ({
      ...c,
      product_count: countMap.get(c.id) ?? 0,
    }))

    setTree(buildTree(catsWithCount))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCategories()
    async function getStore() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('store_id').eq('id', user.id).single() as any
        if (data?.store_id) setStoreId(data.store_id)
      }
    }
    getStore()
  }, [fetchCategories, supabase])

  function openAddModal(pId: string | null = null) {
    setEditingCat(null)
    setParentId(pId)
    setCatName('')
    setCatSlug('')
    setCatActive(true)
    setShowModal(true)
  }

  function openEditModal(cat: CategoryNode) {
    setEditingCat(cat)
    setParentId(cat.parent_id)
    setCatName(cat.name)
    setCatSlug(cat.slug)
    setCatActive(cat.is_active)
    setShowModal(true)
  }

  function openDeleteModal(cat: CategoryNode) {
    setDeletingCat(cat)
    setShowDeleteModal(true)
  }

  async function handleSave() {
    if (!catName.trim()) { toast.error('Category name is required'); return }
    if (!storeId) { toast.error('Store not found'); return }
    setSaving(true)

    const slug = catSlug || slugify(catName)

    if (editingCat) {
      const { error } = await supabase
        .from('categories')
        .update({ name: catName.trim(), slug, is_active: catActive, parent_id: parentId } as any)
        .eq('id', editingCat.id)
      if (error) { toast.error('Failed to update'); setSaving(false); return }
      toast.success('Category updated')
    } else {
      const { error } = await supabase
        .from('categories')
        .insert({
          store_id: storeId,
          name: catName.trim(),
          slug,
          parent_id: parentId,
          is_active: catActive,
          sort_order: 0,
          image_url: null,
        } as any)
      if (error) { toast.error('Failed to create: ' + error.message); setSaving(false); return }
      toast.success('Category created')
    }

    setSaving(false)
    setShowModal(false)
    fetchCategories()
  }

  async function handleDelete() {
    if (!deletingCat) return
    setDeleting(true)

    // Check for child categories
    if (deletingCat.children.length > 0) {
      // Delete children first (cascade)
      const childIds = deletingCat.children.map(c => c.id)
      await supabase.from('categories').delete().in('id', childIds)
    }

    const { error } = await supabase.from('categories').delete().eq('id', deletingCat.id)
    if (error) { toast.error('Failed to delete'); setDeleting(false); return }
    toast.success('Category deleted')
    setDeleting(false)
    setShowDeleteModal(false)
    fetchCategories()
  }

  function countTotal(nodes: CategoryNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + countTotal(n.children), 0)
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Categories</h1>
          <p className="text-sm text-text-muted mt-0.5">{countTotal(tree)} categories in tree</p>
        </div>
        <button onClick={() => openAddModal(null)} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus size={15} /> Add Category
        </button>
      </div>

      <div className="rounded-xl" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        ) : tree.length === 0 ? (
          <div className="p-12 text-center">
            <FolderTree size={32} className="text-text-disabled mx-auto mb-3" />
            <p className="text-sm text-text-muted">No categories yet</p>
            <button onClick={() => openAddModal(null)} className="btn-primary text-sm mt-4">Create first category</button>
          </div>
        ) : (
          <div className="py-2">
            {tree.map(node => (
              <TreeNode key={node.id} node={node} depth={0} onEdit={openEditModal} onDelete={openDeleteModal} onAddChild={(id) => openAddModal(id)} />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Name *</label>
            <input value={catName} onChange={(e) => { setCatName(e.target.value); if (!editingCat) setCatSlug(slugify(e.target.value)) }} className="input-base" placeholder="Category name" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Slug</label>
            <input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} className="input-base" placeholder="auto-generated" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCatActive(!catActive)} className={`toggle-switch ${catActive ? 'active' : ''}`} />
            <span className="text-sm text-text-secondary">Active</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingCat ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Category" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary">
              <p className="font-medium text-danger mb-1">This action cannot be undone.</p>
              {deletingCat && deletingCat.children.length > 0 && (
                <p>This will also delete {deletingCat.children.length} child categor{deletingCat.children.length === 1 ? 'y' : 'ies'}.</p>
              )}
              {deletingCat && deletingCat.product_count > 0 && (
                <p>{deletingCat.product_count} products will be uncategorized.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger flex items-center gap-2">
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
