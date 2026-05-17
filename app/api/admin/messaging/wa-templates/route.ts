import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

async function twilioFetch(path: string, accountSid: string, authToken: string) {
  const res = await fetch(`https://content.twilio.com${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const conf = runtimeConfig.twilio.config
  if (!conf?.accountSid || !conf?.authToken) {
    return NextResponse.json({ templates: [] })
  }

  const { accountSid, authToken } = conf

  const contentData = await twilioFetch('/v1/Content?PageSize=50', accountSid, authToken)
  const templates = []

  for (const c of contentData?.contents ?? []) {
    const approvalData = await twilioFetch(
      `/v1/Content/${c.sid}/ApprovalRequests`,
      accountSid,
      authToken
    )
    const wa = approvalData?.whatsapp ?? {}
    templates.push({
      sid: c.sid,
      name: c.friendly_name,
      language: c.language,
      types: Object.keys(c.types ?? {}),
      body: (Object.values(c.types ?? {}) as any[])[0]?.body ?? '',
      variables: c.variables ?? {},
      waStatus: wa.status ?? 'unsubmitted',
      waName: wa.name ?? null,
      waCategory: wa.category ?? null,
      waRejectionReason: wa.rejection_reason ?? null,
    })
  }

  return NextResponse.json({ templates })
}
