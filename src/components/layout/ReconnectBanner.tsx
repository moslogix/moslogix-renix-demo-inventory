'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WifiOff } from 'lucide-react'

export function ReconnectBanner() {
  const [disconnected, setDisconnected] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel('connectivity-check')

    channel
      .on('system', { event: '*' }, (payload: any) => {
        if (payload.extension === 'postgres_changes') {
          setDisconnected(false)
        }
      })
      .subscribe((status: any) => {
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setDisconnected(true)
        } else if (status === 'SUBSCRIBED') {
          setDisconnected(false)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  if (!disconnected) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 text-black px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2">
      <WifiOff size={14} />
      Reconnecting to real-time data...
    </div>
  )
}
