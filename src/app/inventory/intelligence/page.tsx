'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber } from '@/lib/utils'

import type { Product, CurrentStock, StockMovement } from '@/types/database'
import {
  BarChart3, TrendingUp, TrendingDown, Package, AlertTriangle,
  ShoppingCart, DollarSign, Archive,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const CHART_COLORS = ['#6272f3', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface KPICardData {
  label: string
  value: string
  subValue?: string
  icon: React.ReactNode
  color: string
}

export default function IntelligencePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [stockData, setStockData] = useState<CurrentStock[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  // Computed analytics
  const [kpis, setKpis] = useState<KPICardData[]>([])
  const [fastMoving, setFastMoving] = useState<{ name: string; count: number }[]>([])
  const [deadStock, setDeadStock] = useState<Product[]>([])
  const [lowMargin, setLowMargin] = useState<(Product & { margin: number })[]>([])
  const [stockValueByCategory, setStockValueByCategory] = useState<{ name: string; value: number }[]>([])
  const [reorderSuggestions, setReorderSuggestions] = useState<(Product & { current_qty: number })[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString()

    const [prodsRes, stockRes, movementsRes, recentSalesRes, catsRes, posRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('current_stock').select('*'),
      supabase.from('stock_movements').select('*').gte('created_at', thirtyDaysAgo),
      supabase.from('stock_movements').select('product_id, quantity').eq('movement_type', 'sale').gte('created_at', thirtyDaysAgo),
      supabase.from('categories').select('id, name'),
      supabase.from('purchase_orders').select('id, status'),
    ])

    const prods = (prodsRes.data as Product[]) ?? []
    const stock = (stockRes.data as CurrentStock[]) ?? []
    const movs = (movementsRes.data as StockMovement[]) ?? []
    const recentSales = (recentSalesRes.data as any[]) ?? []
    const cats = (catsRes.data as any[]) ?? []
    const openPOs = (posRes.data as any[] ?? []).filter(po => ['draft', 'submitted', 'confirmed', 'in_transit'].includes(po.status))

    setProducts(prods)
    setStockData(stock)
    setMovements(movs)
    setCategories(cats)

    // ---- Compute KPIs ----
    // Total stock value
    const stockMap = new Map<string, number>()
    stock.forEach(s => {
      stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + Number(s.quantity ?? (s as any).quantity_on_hand ?? 0))
    })

    let totalStockValue = 0
    prods.forEach(p => {
      const qty = stockMap.get(p.id) ?? 0
      totalStockValue += qty * (p.cost_price ?? p.selling_price)
    })

    const totalSKUs = prods.length
    const lowStockCount = stock.filter(s => s.is_low_stock).length
    const outOfStockProducts = prods.filter(p => (stockMap.get(p.id) ?? 0) <= 0)

    setKpis([
      {
        label: 'Total Stock Value',
        value: formatCurrency(totalStockValue),
        icon: <DollarSign size={20} />,
        color: '#6272f3',
      },
      {
        label: 'Active SKUs',
        value: formatNumber(totalSKUs),
        icon: <Package size={20} />,
        color: '#10b981',
      },
      {
        label: 'Low Stock Alerts',
        value: formatNumber(lowStockCount),
        icon: <AlertTriangle size={20} />,
        color: '#f59e0b',
      },
      {
        label: 'Out of Stock',
        value: formatNumber(outOfStockProducts.length),
        icon: <Archive size={20} />,
        color: '#ef4444',
      },
    ])

    // ---- Fast-moving products (most sale movements in 30d) ----
    const saleCounts = new Map<string, number>()
    recentSales.forEach(s => {
      saleCounts.set(s.product_id, (saleCounts.get(s.product_id) ?? 0) + Math.abs(s.quantity))
    })

    const prodNameMap = new Map(prods.map(p => [p.id, p.name]))
    const fastMovingArr = Array.from(saleCounts.entries())
      .map(([id, count]) => ({ name: prodNameMap.get(id) ?? 'Unknown', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    setFastMoving(fastMovingArr)

    // ---- Dead stock (no sales in 60d) ----
    const { data: olderSales } = await supabase
      .from('stock_movements')
      .select('product_id')
      .eq('movement_type', 'sale')
      .gte('created_at', sixtyDaysAgo)

    const soldProductIds = new Set(((olderSales as any[]) ?? []).map(s => s.product_id))
    const deadStockProds = prods.filter(p => !soldProductIds.has(p.id) && (stockMap.get(p.id) ?? 0) > 0)
    setDeadStock(deadStockProds.slice(0, 20))

    // ---- Low margin products ----
    const lowMarginProds = prods
      .filter(p => p.cost_price && p.cost_price > 0)
      .map(p => ({
        ...p,
        margin: ((p.selling_price - (p.cost_price ?? 0)) / p.selling_price) * 100,
      }))
      .filter(p => p.margin < 10 && p.margin >= 0)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 15)
    setLowMargin(lowMarginProds)

    // ---- Stock value by category ----
    const catMap = new Map(cats.map(c => [c.id, c.name]))
    const catValues = new Map<string, number>()
    prods.forEach(p => {
      const catName = p.category_id ? catMap.get(p.category_id) ?? 'Uncategorized' : 'Uncategorized'
      const qty = stockMap.get(p.id) ?? 0
      const value = qty * (p.cost_price ?? p.selling_price)
      catValues.set(catName, (catValues.get(catName) ?? 0) + value)
    })
    const svData = Array.from(catValues.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
    setStockValueByCategory(svData)

    // ---- Reorder suggestions ----
    const openPOProductIds = new Set<string>()
    if (openPOs.length > 0) {
      const poIds = openPOs.map((po: any) => po.id)
      const poItemsRes = await supabase
        .from('purchase_order_items')
        .select('product_id')
        .in('purchase_order_id', poIds)
      const poItemsList: any[] = poItemsRes.data ?? []
      poItemsList.forEach((i: any) => openPOProductIds.add(i.product_id))
    }

    const reorderProds = prods
      .filter(p => {
        const qty = stockMap.get(p.id) ?? 0
        return qty <= p.low_stock_threshold && !openPOProductIds.has(p.id)
      })
      .map(p => ({ ...p, current_qty: stockMap.get(p.id) ?? 0 }))
      .sort((a, b) => a.current_qty - b.current_qty)
    setReorderSuggestions(reorderProds)

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="skeleton h-72 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <BarChart3 size={20} /> Inventory Intelligence
        </h1>
        <p className="text-sm text-text-muted mt-0.5">Analytics and insights for smarter inventory decisions</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="rounded-xl p-5 card-lift" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">{kpi.label}</div>
                <div className="text-xl font-bold text-text-primary">{kpi.value}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Fast-moving products */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-success" /> Fast-Moving Products (30 days)
          </h2>
          {fastMoving.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">No sales data in the last 30 days</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={fastMoving} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e293b' }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={{ stroke: '#1e293b' }}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #253044', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f0f4ff' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Stock value by category */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <DollarSign size={14} className="text-brand-400" /> Stock Value by Category
          </h2>
          {stockValueByCategory.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">No stock value data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stockValueByCategory}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {stockValueByCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #253044', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Reorder suggestions */}
      <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ShoppingCart size={14} className="text-warning" /> Reorder Suggestions
          </h2>
          <span className="text-xs text-text-muted">{reorderSuggestions.length} items need reordering</span>
        </div>
        {reorderSuggestions.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">All products are well stocked 🎉</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {reorderSuggestions.map(p => (
              <div
                key={p.id}
                className="rounded-lg p-3 cursor-pointer hover:border-brand-500 transition-colors"
                style={{ background: '#111827', border: '1px solid #1e293b' }}
                onClick={() => router.push(`/inventory/products/${p.id}`)}
              >
                <div className="text-sm font-medium text-text-primary truncate">{p.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <span className="text-[11px] text-text-muted">Stock: </span>
                    <span className={`font-mono text-sm font-medium ${p.current_qty <= 0 ? 'text-danger' : 'text-warning'}`}>
                      {p.current_qty}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-disabled">min: {p.low_stock_threshold}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); router.push('/inventory/purchase-orders/new') }}
                  className="mt-2 w-full text-center text-[11px] font-medium py-1 rounded text-brand-300 hover:bg-brand-500/10 transition-colors"
                  style={{ border: '1px solid rgba(99,114,243,0.2)' }}
                >
                  Create PO →
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-6">
        {/* Dead stock */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <TrendingDown size={14} className="text-danger" /> Dead Stock (No sales in 60 days)
          </h2>
          {deadStock.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">No dead stock detected 🎉</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deadStock.map(p => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/inventory/products/${p.id}`)}
                  className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer hover:bg-bg-muted transition-colors"
                >
                  <span className="text-sm text-text-primary">{p.name}</span>
                  <span className="text-xs text-text-muted">{formatCurrency(p.selling_price)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Low margin */}
        <section className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid #1e293b' }}>
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" /> Low Margin Products (&lt;10%)
          </h2>
          {lowMargin.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">No low-margin products 🎉</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowMargin.map(p => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/inventory/products/${p.id}`)}
                  className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer hover:bg-bg-muted transition-colors"
                >
                  <div>
                    <span className="text-sm text-text-primary">{p.name}</span>
                    <span className="text-[11px] text-text-muted ml-2">
                      {formatCurrency(p.cost_price ?? 0)} → {formatCurrency(p.selling_price)}
                    </span>
                  </div>
                  <span className={`font-mono text-sm font-medium ${p.margin < 5 ? 'text-danger' : 'text-warning'}`}>
                    {p.margin.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
