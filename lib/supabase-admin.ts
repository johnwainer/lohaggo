import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdmin) return cachedAdmin

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) return null

  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  return cachedAdmin
}

export async function emitProposalBroadcast(proposalId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  if (!admin) return

  try {
    const channel = admin.channel(`proposal:${proposalId}`, {
      config: { broadcast: { ack: false, self: false } },
    })
    await channel.subscribe()
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: { proposalId, t: Date.now() },
    })
    await admin.removeChannel(channel)
  } catch {
    // Realtime is best-effort; polling acts as fallback
  }
}
