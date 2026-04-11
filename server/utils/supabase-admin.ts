import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client (service role — bypasses RLS).
 * Use ONLY for server-to-server operations where user context is not applicable,
 * e.g.: webhook handlers, cron jobs, after-payment order creation.
 *
 * NEVER expose service role key to client.
 * NEVER use adminClient for user-initiated operations.
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '',
)
