export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { DemoBanner } from '@/components/DemoBanner'

export const metadata: Metadata = {
  title: {
    default: 'MOS Logix — Inventory (Demo)',
    template: '%s | MOS Logix Inventory (Demo)',
  },
  description: 'MOS Logix Inventory Management System - Demo for testing only (cannot be used for distribution)',
  robots: 'noindex, nofollow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DemoBanner />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid #253044',
              color: '#f0f4ff',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
            },
          }}
          richColors
        />
      </body>
    </html>
  )
}

