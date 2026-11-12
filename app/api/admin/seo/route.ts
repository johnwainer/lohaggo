import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { seoOverview } from '@/lib/seo/agent/views'
import { DEFAULT_SEO_CONFIG } from '@/lib/seo/agent/settings-core'

export const dynamic = 'force-dynamic'

/** Everything the SEO panel shows: settings, health, Search Console, opportunities, runs. Every admin reads it. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const overview = await seoOverview()
  return NextResponse.json({ ...overview, defaults: DEFAULT_SEO_CONFIG, canEdit: Boolean(admin.isSuperAdmin) })
}
