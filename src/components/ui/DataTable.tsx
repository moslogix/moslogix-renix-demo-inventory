'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  emptyMessage?: string
  onRowClick?: (row: T) => void
  rowKey: (row: T) => string
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  toolbar?: React.ReactNode
  onExport?: () => void
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  pageSize = 15,
  emptyMessage = 'No data found',
  onRowClick,
  rowKey,
  selectable = false,
  selectedIds,
  onSelectionChange,
  toolbar,
  onExport,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((v) =>
        String(v ?? '').toLowerCase().includes(q)
      )
    )
  }, [data, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey]
      const bv = (b as Record<string, unknown>)[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av ?? '')
      const bs = String(bv ?? '')
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  const allSelected = paginated.length > 0 && paginated.every((r) => selectedIds?.has(rowKey(r)))

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleAll() {
    if (!onSelectionChange) return
    const newSet = new Set(selectedIds)
    if (allSelected) {
      paginated.forEach((r) => newSet.delete(rowKey(r)))
    } else {
      paginated.forEach((r) => newSet.add(rowKey(r)))
    }
    onSelectionChange(newSet)
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    onSelectionChange(newSet)
  }

  const skeletonRows = Array.from({ length: pageSize })

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar + toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {searchable && (
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={searchPlaceholder}
              className="input-base pl-8 py-2 text-sm"
            />
          </div>
        )}
        <div className="flex-1" />
        {toolbar}
        {onExport && (
          <button onClick={onExport} className="btn-secondary flex items-center gap-2 text-xs py-2 px-3">
            <Download size={13} />
            Export
          </button>
        )}
      </div>

      {/* Selected count */}
      {selectable && selectedIds && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: 'rgba(99,114,243,0.08)', border: '1px solid rgba(99,114,243,0.2)' }}>
          <span className="text-xs font-medium text-brand-300">
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => onSelectionChange?.(new Set())}
            className="text-xs text-text-muted hover:text-text-primary transition-colors ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e293b' }}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {selectable && (
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="checkbox-base"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    style={{ width: col.width }}
                    onClick={() => col.sortable && handleSort(String(col.key))}
                    className={col.sortable ? 'cursor-pointer select-none hover:text-text-secondary' : ''}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && sortKey === String(col.key) && (
                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? skeletonRows.map((_, i) => (
                    <tr key={i}>
                      {selectable && <td><div className="skeleton h-4 w-4 rounded" /></td>}
                      {columns.map((col) => (
                        <td key={String(col.key)}>
                          <div className="skeleton h-4 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : paginated.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-12 text-text-muted text-sm">
                        {emptyMessage}
                      </td>
                    </tr>
                  )
                : paginated.map((row) => {
                    const id = rowKey(row)
                    const selected = selectedIds?.has(id)
                    return (
                      <tr
                        key={id}
                        onClick={() => onRowClick?.(row)}
                        className={onRowClick ? 'cursor-pointer' : ''}
                        style={selected ? { background: 'rgba(99,114,243,0.06)' } : undefined}
                      >
                        {selectable && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="checkbox-base"
                              checked={selected || false}
                              onChange={() => toggleRow(id)}
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td key={String(col.key)}>
                            {col.render
                              ? col.render(row)
                              : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid #111827' }}
          >
            <span className="text-xs text-text-muted">
              {sorted.length} result{sorted.length !== 1 ? 's' : ''} · Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = i + Math.max(1, Math.min(page - 2, totalPages - 4))
                if (n > totalPages) return null
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className="w-7 h-7 rounded text-xs font-medium transition-colors"
                    style={{
                      background: page === n ? 'rgba(99,114,243,0.15)' : 'transparent',
                      color: page === n ? '#a5bbfc' : '#64748b',
                    }}
                  >
                    {n}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
