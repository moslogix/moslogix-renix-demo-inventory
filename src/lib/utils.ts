export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en').format(n)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'text-text-muted bg-text-muted/10',
    submitted: 'text-info bg-info/10',
    confirmed: 'text-brand-400 bg-brand-400/10',
    in_transit: 'text-warning bg-warning/10',
    received: 'text-success bg-success/10',
    cancelled: 'text-danger bg-danger/10',
    active: 'text-success bg-success/10',
    inactive: 'text-danger bg-danger/10',
    pending: 'text-warning bg-warning/10',
    preparing: 'text-brand-400 bg-brand-400/10',
    ready: 'text-success bg-success/10',
    delivered: 'text-success bg-success/10',
    refunded: 'text-text-muted bg-text-muted/10',
    open: 'text-success bg-success/10',
    closed: 'text-text-muted bg-text-muted/10',
  }
  return map[status] ?? 'text-text-secondary bg-text-secondary/10'
}

export function getMovementTypeColor(type: string): { text: string; bg: string } {
  const map: Record<string, { text: string; bg: string }> = {
    purchase: { text: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    sale: { text: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    return: { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    adjustment: { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    transfer: { text: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
    initial: { text: '#6272f3', bg: 'rgba(99,114,243,0.1)' },
  }
  return map[type] ?? { text: '#64748b', bg: 'rgba(100,116,139,0.1)' }
}

export function getStockStatus(qty: number, threshold: number): {
  label: string
  color: string
  bg: string
} {
  if (qty <= 0) return { label: 'Out of Stock', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  if (qty <= threshold) return { label: 'Low Stock', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  return { label: 'In Stock', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
}

export function calculateMargin(sellingPrice: number, costPrice: number): number {
  if (sellingPrice <= 0) return 0
  return ((sellingPrice - costPrice) / sellingPrice) * 100
}

export function generateSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'SKU-'
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generatePONumber(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PO-${datePart}-${randPart}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: NodeJS.Timeout
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
