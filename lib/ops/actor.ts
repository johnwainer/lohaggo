import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { OpsError, type Actor } from '@/lib/ops/origin'

/** The signed-in person as an Actor for lib/*\/ops.ts, or null when there is no session. */
export async function currentActor(): Promise<Actor | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return { userId: user.id, role: user.role, partnerId: user.partnerProfile?.id ?? null, email: user.email }
}

/** Maps an OpsError to the JSON a route answers with; anything else is rethrown for the route's handler. */
export function opsErrorResponse(err: unknown, extra?: (err: OpsError) => Record<string, unknown>) {
  if (err instanceof OpsError) return NextResponse.json({ error: err.message, ...(extra ? extra(err) : {}) }, { status: err.status })
  throw err
}
