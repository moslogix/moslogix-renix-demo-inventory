'use client'

import { getStockStatus } from '@/lib/utils'

interface StockBadgeProps {
  quantity: number
  threshold: number
}

export function StockBadge({ quantity, threshold }: StockBadgeProps) {
  const status = getStockStatus(quantity, threshold)

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm font-medium" style={{ color: status.color }}>
        {quantity}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
        style={{ color: status.color, background: status.bg }}
      >
        {status.label}
      </span>
    </div>
  )
}
