import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { runFraudScan } from '@/lib/fraud/signals'
import { qualifyReferrals } from '@/lib/referrals/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Nightly: fraud signals (off-platform pairs, shared phones) and referral qualification. */
export const GET = cronRoute('growth-nightly', async () => {
  const [fraud, referrals] = await Promise.all([runFraudScan(), qualifyReferrals()])
  return NextResponse.json({ ok: true, fraud, referrals })
}, { maxDuration: 120 })
