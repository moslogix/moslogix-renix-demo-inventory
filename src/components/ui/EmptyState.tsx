'use client'

import { Package } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(99,114,243,0.08)', border: '1px solid rgba(99,114,243,0.15)' }}
      >
        {icon || <Package size={24} className="text-brand-400" />}
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted max-w-xs text-center">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
