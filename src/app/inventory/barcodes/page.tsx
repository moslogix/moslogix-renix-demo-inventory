'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Product } from '@/types/database'
import {
  ScanBarcode, Search, Printer, FileDown, X, Package, Check,
} from 'lucide-react'

function BarcodeCanvas({ value, width = 200, height = 80 }: { value: string; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function render() {
      if (!canvasRef.current || !value) return
      try {
        const bwipjs = (await import('bwip-js')).default
        bwipjs.toCanvas(canvasRef.current, {
          bcid: value.length === 13 ? 'ean13' : value.length === 8 ? 'ean8' : 'code128',
          text: value,
          scale: 2,
          height: 10,
          includetext: true,
          textxalign: 'center',
          textsize: 8,
          backgroundcolor: 'ffffff',
        })
      } catch {
        // Fallback: just show text
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.fillStyle = '#000000'
          ctx.font = '12px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(value, width / 2, height / 2)
        }
      }
    }
    render()
  }, [value, width, height])

  return <canvas ref={canvasRef} style={{ maxWidth: width, maxHeight: height }} />
}

export default function BarcodesPage() {
  const supabase = createClient()


  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // Barcode lookup
  const [lookupValue, setLookupValue] = useState('')
  const [lookupResult, setLookupResult] = useState<Product | null>(null)
  const [lookupNotFound, setLookupNotFound] = useState(false)
  const lookupRef = useRef<HTMLInputElement>(null)

  // Search products for selection
  useEffect(() => {
    async function search() {
      if (searchQuery.length < 2) { setSearchResults([]); return }
      const { data } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(20)
      setSearchResults(data ?? [])
    }
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, supabase])

  function toggleProduct(product: Product) {
    setSelectedProducts(prev => {
      const exists = prev.some(p => p.id === product.id)
      if (exists) return prev.filter(p => p.id !== product.id)
      return [...prev, product]
    })
  }

  // Barcode lookup (scanner trap)
  async function handleLookup() {
    if (!lookupValue.trim()) return
    setLookupNotFound(false)
    setLookupResult(null)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', lookupValue.trim())
      .single()

    if (error || !data) {
      setLookupNotFound(true)
    } else {
      setLookupResult(data)
    }
  }

  // Generate PDF with barcode labels
  async function generatePDF() {
    if (selectedProducts.length === 0) { toast.error('Select at least one product'); return }
    setLoading(true)

    try {
      const { default: jsPDF } = await import('jspdf')
      const bwipjs = (await import('bwip-js')).default

      const doc = new jsPDF('p', 'mm', 'a4')
      const labelsPerRow = 3
      const labelsPerCol = 8
      const labelW = 60
      const labelH = 30
      const marginX = 12
      const marginY = 15
      const gapX = 5
      const gapY = 5

      let labelIndex = 0

      for (const product of selectedProducts) {
        const barcodeValue = product.barcode || product.sku || product.id.slice(0, 12)
        const col = labelIndex % labelsPerRow
        const row = Math.floor(labelIndex / labelsPerRow) % labelsPerCol

        if (labelIndex > 0 && labelIndex % (labelsPerRow * labelsPerCol) === 0) {
          doc.addPage()
        }

        const x = marginX + col * (labelW + gapX)
        const y = marginY + row * (labelH + gapY)

        // Label border
        doc.setDrawColor(200)
        doc.rect(x, y, labelW, labelH)

        // Product name
        doc.setFontSize(7)
        doc.setTextColor(0)
        const nameTrunc = product.name.length > 25 ? product.name.slice(0, 25) + '...' : product.name
        doc.text(nameTrunc, x + labelW / 2, y + 4, { align: 'center' })

        // Price
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(formatCurrency(product.selling_price), x + labelW / 2, y + 8, { align: 'center' })
        doc.setFont('helvetica', 'normal')

        // Barcode
        try {
          const canvas = document.createElement('canvas')
          bwipjs.toCanvas(canvas, {
            bcid: barcodeValue.length === 13 ? 'ean13' : 'code128',
            text: barcodeValue,
            scale: 3,
            height: 8,
            includetext: true,
            textxalign: 'center',
            textsize: 6,
          })
          const imgData = canvas.toDataURL('image/png')
          doc.addImage(imgData, 'PNG', x + 5, y + 10, labelW - 10, 18)
        } catch {
          doc.setFontSize(6)
          doc.text(barcodeValue, x + labelW / 2, y + 20, { align: 'center' })
        }

        labelIndex++
      }

      doc.save(`barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success(`Generated PDF with ${selectedProducts.length} labels`)
    } catch (err) {
      toast.error('Failed to generate PDF')
      console.error(err)
    }

    setLoading(false)
  }

  function handlePrint() {
    const printArea = document.getElementById('barcode-preview-grid')
    if (!printArea) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .label { border: 1px solid #ddd; padding: 8px; text-align: center; page-break-inside: avoid; }
            .label h4 { font-size: 10px; margin: 0 0 2px; }
            .label p { font-size: 9px; margin: 0 0 4px; color: #666; }
            canvas { max-width: 100%; }
            @media print { body { padding: 10mm; } }
          </style>
        </head>
        <body>${printArea.innerHTML}</body>
      </html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <ScanBarcode size={20} /> Barcode Management
          </h1>
          <p className="text-sm text-text-muted mt-0.5">Generate, print, and lookup barcodes</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Product selector + barcode generation */}
        <div className="space-y-6">
          {/* Product search */}
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Select Products</h2>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-8 text-sm"
                placeholder="Search by name, SKU, or barcode..."
              />
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg mb-3" style={{ border: '1px solid #1e293b' }}>
                {searchResults.map(p => {
                  const isSelected = selectedProducts.some(sp => sp.id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProduct(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-bg-muted transition-colors flex items-center justify-between"
                      style={{ borderBottom: '1px solid #111827' }}
                    >
                      <div>
                        <span className="text-sm text-text-primary">{p.name}</span>
                        <span className="text-[11px] text-text-muted ml-2 font-mono">{p.barcode || p.sku || '—'}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-success" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Selected products */}
            <div className="text-xs text-text-muted mb-2">{selectedProducts.length} products selected</div>
            <div className="flex flex-wrap gap-2">
              {selectedProducts.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(99,114,243,0.08)', border: '1px solid rgba(99,114,243,0.2)' }}>
                  <span className="text-brand-300">{p.name}</span>
                  <button onClick={() => toggleProduct(p)} className="text-text-muted hover:text-danger transition-colors"><X size={10} /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={generatePDF} disabled={loading || selectedProducts.length === 0} className="btn-primary flex items-center gap-2 text-sm flex-1">
              <FileDown size={14} /> {loading ? 'Generating...' : 'Generate PDF'}
            </button>
            <button onClick={handlePrint} disabled={selectedProducts.length === 0} className="btn-secondary flex items-center gap-2 text-sm flex-1">
              <Printer size={14} /> Print Labels
            </button>
          </div>

          {/* Barcode lookup */}
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Barcode Lookup</h2>
            <p className="text-xs text-text-muted mb-3">Scan a barcode or type it manually to find a product</p>
            <div className="flex gap-2">
              <input
                ref={lookupRef}
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLookup() }}
                className="input-base text-sm font-mono flex-1"
                placeholder="Scan or type barcode..."
                autoComplete="off"
              />
              <button onClick={handleLookup} className="btn-primary text-sm px-4">Lookup</button>
            </div>

            {lookupNotFound && (
              <div className="mt-3 p-3 rounded-lg text-xs text-warning" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                No product found with barcode &quot;{lookupValue}&quot;
              </div>
            )}

            {lookupResult && (
              <div className="mt-3 p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #253044' }}>
                <div className="flex items-start gap-3">
                  {(lookupResult as any).image_url ? (
                    <img src={(lookupResult as any).image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: '#1a2332' }}>
                      <Package size={20} className="text-text-muted" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-text-primary">{lookupResult.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      {lookupResult.sku && <span className="text-xs text-text-muted font-mono">SKU: {lookupResult.sku}</span>}
                      <span className="text-sm font-medium text-brand-300">{formatCurrency(lookupResult.selling_price)}</span>
                    </div>
                    <div className="mt-1">
                      <Badge variant={lookupResult.is_active ? 'success' : 'danger'}>
                        {lookupResult.is_active ? 'Active' : 'Archived'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: Barcode preview grid */}
        <div>
          <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Preview</h2>
            {selectedProducts.length === 0 ? (
              <div className="text-center py-12">
                <ScanBarcode size={32} className="text-text-disabled mx-auto mb-3" />
                <p className="text-sm text-text-muted">Select products to preview barcodes</p>
              </div>
            ) : (
              <div id="barcode-preview-grid" className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                {selectedProducts.map(p => {
                  const barcodeVal = p.barcode || p.sku || p.id.slice(0, 12)
                  return (
                    <div key={p.id} className="label rounded-lg p-3 text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ color: '#000', fontSize: 10, margin: '0 0 2px', fontWeight: 600 }}>
                        {p.name.length > 25 ? p.name.slice(0, 25) + '...' : p.name}
                      </h4>
                      <p style={{ color: '#666', fontSize: 9, margin: '0 0 4px' }}>{formatCurrency(p.selling_price)}</p>
                      <BarcodeCanvas value={barcodeVal} width={160} height={60} />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
