'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateSKU, calculateMargin, formatCurrency } from '@/lib/utils'
import type { Category, Supplier, TaxRule } from '@/types/database'
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'

interface VariantRow {
  id: string
  name: string
  sku: string
  attributes: Record<string, string>
  price_override: string
}

export default function NewProductPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Form state
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
  const [initialStock, setInitialStock] = useState('0')
  const [branchId, setBranchId] = useState('')

  // Variants
  const [variants, setVariants] = useState<VariantRow[]>([])

  // Images
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  // Metadata
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [taxRules, setTaxRules] = useState<TaxRule[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    async function fetchMeta() {
      const [catsRes, supsRes, taxRes, branchRes, profileRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
        supabase.from('tax_rules').select('*').eq('is_active', true).order('name'),
        supabase.from('branches').select('id, name').eq('is_active', true),
        supabase.auth.getUser(),
      ])
      setCategories(catsRes.data ?? [])
      setSuppliers(supsRes.data ?? [])
      setTaxRules(taxRes.data ?? [])
      const branchList = branchRes.data ?? []
      setBranches(branchList)
      if (branchList.length > 0) setBranchId(branchList[0].id)

      // Get user's store_id from profile
      if (profileRes.data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('store_id')
          .eq('id', profileRes.data.user.id)
          .single()
        if (prof?.store_id) setStoreId(prof.store_id)
      }
    }
    fetchMeta()
  }, [supabase])

  const [storeId, setStoreId] = useState('')

  const margin = calculateMargin(parseFloat(sellingPrice) || 0, parseFloat(costPrice) || 0)

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setImageFiles((prev) => [...prev, ...files])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', sku: '', attributes: {}, price_override: '' },
    ])
  }

  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  function updateVariant(id: string, field: keyof VariantRow, value: string) {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    )
  }

  async function uploadImages(): Promise<string[]> {
    const urls: string[] = []
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop()
      const path = `products/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('renix-storage')
        .upload(path, file, { cacheControl: '3600' })
      if (error) {
        toast.error(`Failed to upload ${file.name}`)
        continue
      }
      const { data: urlData } = supabase.storage
        .from('renix-storage')
        .getPublicUrl(path)
      urls.push(urlData.publicUrl)
    }
    return urls
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Product name is required'); return }
    if (!sellingPrice || parseFloat(sellingPrice) <= 0) { toast.error('Valid selling price is required'); return }
    if (!storeId) { toast.error('Store not found. Please check your profile.'); return }
    if (!branchId) { toast.error('Please select a branch'); return }

    setSaving(true)

    // Upload images
    let imageUrls: string[] = []
    if (imageFiles.length > 0) {
      setUploading(true)
      imageUrls = await uploadImages()
      setUploading(false)
    }

    // Insert product (pre-generate ID to avoid .select() and PostgREST cast issues)
    const productId = crypto.randomUUID()
    const { error } = await supabase
      .from('products')
      .insert({
        id: productId,
        store_id: storeId,
        name: name.trim(),
        sku: sku || `SKU-${Date.now()}`, // SKU is now NOT NULL in schema
        barcode: barcode || null,
        description: description || null,
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        selling_price: parseFloat(sellingPrice) || 0,
        cost_price: costPrice ? parseFloat(costPrice) : 0,
        images: imageUrls,
        is_active: true,
        is_taxable: isTaxable,
        tax_category: taxCategory || null,
        low_stock_threshold: parseInt(lowStockThreshold) || 10,
      } as any)

    if (error) {
      toast.error('Failed to create product: ' + error.message)
      setSaving(false)
      return
    }

    // Insert variants
    if (variants.length > 0) {
      const variantInserts = variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          product_id: productId,
          name: v.name.trim(),
          sku: v.sku || `VAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // SKU is NOT NULL
          barcode: null,
          attributes: v.attributes,
          selling_price: v.price_override ? parseFloat(v.price_override) : null,
          cost_price: null,
          is_active: true,
        }))

      if (variantInserts.length > 0) {
        const { error: varErr } = await supabase
          .from('product_variants')
          .insert(variantInserts as any)
        if (varErr) toast.error('Some variants failed to save')
      }
    }

    // Insert initial stock movement
    const initialQty = parseInt(initialStock) || 0
    if (initialQty > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('stock_movements').insert({
        store_id: storeId,
        product_id: productId,
        branch_id: branchId,
        movement_type: 'initial',
        quantity: initialQty,
        notes: 'Initial stock on product creation',
        created_by: user?.id || null,
      } as any)
    }

    toast.success('Product created successfully')
    router.push(`/inventory/products/${productId}`)
  }

  return (
    <div className="p-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="btn-icon">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Add Product</h1>
          <p className="text-sm text-text-muted">Create a new product in your catalog</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Product Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="Enter product name" required />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">SKU</label>
              <div className="flex gap-2">
                <input value={sku} onChange={(e) => setSku(e.target.value)} className="input-base" placeholder="SKU-XXXXXXXX" />
                <button type="button" onClick={() => setSku(generateSKU())} className="btn-secondary shrink-0 flex items-center gap-1.5 text-xs px-3">
                  <Wand2 size={12} /> Auto
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Barcode</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="input-base" placeholder="EAN-13 or custom" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-base">
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-base">
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-base" placeholder="Optional description" rows={3} />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Pricing</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Cost Price (EGP)</label>
              <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="input-base" placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Selling Price (EGP) *</label>
              <input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="input-base" placeholder="0.00" min="0" step="0.01" required />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Margin</label>
              <div className="input-base flex items-center" style={{ cursor: 'default' }}>
                <span className={`font-mono text-sm font-medium ${margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}`}>
                  {margin.toFixed(1)}%
                </span>
                {costPrice && sellingPrice && (
                  <span className="text-[11px] text-text-muted ml-2">
                    ({formatCurrency(parseFloat(sellingPrice) - parseFloat(costPrice))} profit)
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Tax */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Tax</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsTaxable(!isTaxable)}
                className={`toggle-switch ${isTaxable ? 'active' : ''}`}
              />
              <span className="text-sm text-text-secondary">Taxable product</span>
            </div>
            {isTaxable && (
              <div>
                <label className="block text-xs text-text-secondary mb-1">Tax Category</label>
                <select value={taxCategory} onChange={(e) => setTaxCategory(e.target.value)} className="input-base">
                  <option value="">Default VAT (14%)</option>
                  {taxRules.map((t) => (
                    <option key={t.id} value={t.category}>{t.name} ({(t.rate * 100).toFixed(0)}%)</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Images */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Images</h2>
          <div className="flex flex-wrap gap-3">
            {imagePreviews.map((preview, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group" style={{ border: '1px solid #253044' }}>
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(239,68,68,0.9)' }}
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition-colors" style={{ border: '1px dashed #253044', background: '#111827' }}>
              <Upload size={16} className="text-text-muted mb-1" />
              <span className="text-[10px] text-text-muted">Upload</span>
              <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            </label>
          </div>
        </section>

        {/* Stock */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Stock</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Initial Quantity</label>
              <input type="number" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} className="input-base" placeholder="0" min="0" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Low Stock Threshold</label>
              <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="input-base" placeholder="10" min="0" />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Branch *</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input-base" required>
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Variants */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Variants</h2>
            <button type="button" onClick={addVariant} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Plus size={12} /> Add Variant
            </button>
          </div>
          {variants.length === 0 ? (
            <p className="text-xs text-text-muted">No variants added. Add variants for different sizes, colors, etc.</p>
          ) : (
            <div className="space-y-3">
              {variants.map((v, i) => (
                <div key={v.id} className="flex items-start gap-3 rounded-lg p-3" style={{ background: '#111827', border: '1px solid #1e293b' }}>
                  <span className="text-[11px] text-text-muted font-mono mt-2.5">#{i + 1}</span>
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Name</label>
                      <input value={v.name} onChange={(e) => updateVariant(v.id, 'name', e.target.value)} className="input-base text-sm py-2" placeholder="e.g. Large, Red" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">SKU</label>
                      <input value={v.sku} onChange={(e) => updateVariant(v.id, 'sku', e.target.value)} className="input-base text-sm py-2" placeholder="Optional" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Price Override (EGP)</label>
                      <input type="number" value={v.price_override} onChange={(e) => updateVariant(v.id, 'price_override', e.target.value)} className="input-base text-sm py-2" placeholder="Same as product" min="0" step="0.01" />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeVariant(v.id)} className="btn-icon mt-5 shrink-0">
                    <Trash2 size={13} className="text-danger" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {uploading ? 'Uploading images...' : saving ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  )
}
