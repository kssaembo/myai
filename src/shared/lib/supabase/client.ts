import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { getSupabaseEnvironment } from './env'

const { url, publishableKey } = getSupabaseEnvironment()

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
})
