import { createBrowserClient } from '@supabase/ssr'

// Note: We intentionally do not pass the Database generic here.
// supabase-js v2.47+ requires a `PostgrestVersion` field in the Database type
// which the current schema definition does not include, causing all typed
// queries to resolve to `never`. Explicit type casts are used in components instead.
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co'),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock')
  ) as any
}

