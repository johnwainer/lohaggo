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

function extractBodyFromComponents(components: any[]): string {
  const body = components?.find((c: any) => c.type === 'BODY')
  return body?.text ?? ''
}

async function fetchMetaTemplates(accessToken: string, wabaId: string) {
  const url = `https://graph.facebook.com/v18.0/${wabaId}/message_templates?fields=name,language,status,category,components&limit=100&access_token=${accessToken}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const templates = []
  for (const t of data?.data ?? []) {
    templates.push({
      sid: `meta:${t.name}:${t.language}`,
      name: t.name,
      language: t.language,
      types: ['twilio/text'],
      body: extractBodyFromComponents(t.components ?? []),
      variables: {},
      waStatus: (t.status ?? '').toLowerCase(),
      waName: t.name,
      waCategory: t.category ?? null,
      waRejectionReason: null,
      source: 'meta' as const,
    })
  }
  return templates
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()

  const twilioTemplates: any[] = []
  const conf = runtimeConfig.twilio.config
  if (conf?.accountSid && conf?.authToken) {
    const { accountSid, authToken } = conf
    const contentData = await twilioFetch('/v1/Content?PageSize=50', accountSid, authToken)
    for (const c of contentData?.contents ?? []) {
      const approvalData = await twilioFetch(
        `/v1/Content/${c.sid}/ApprovalRequests`,
        accountSid,
        authToken
      )
      const wa = approvalData?.whatsapp ?? {}
      twilioTemplates.push({
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
        source: 'twilio' as const,
      })
    }
  }

  const metaTemplates: any[] = []
  const metaConf = runtimeConfig.metaWhatsApp.config
  if (runtimeConfig.metaWhatsApp.active && metaConf?.accessToken && metaConf?.wabaId) {
    const fetched = await fetchMetaTemplates(metaConf.accessToken, metaConf.wabaId)
    metaTemplates.push(...fetched)
  }

  // Merge: Meta templates take precedence; skip Twilio duplicates by waName match
  const metaNames = new Set(metaTemplates.map((t) => t.waName))
  const filteredTwilio = twilioTemplates.filter((t) => !metaNames.has(t.waName))

  const templates = [...metaTemplates, ...filteredTwilio]

  return NextResponse.json({ templates })
}
