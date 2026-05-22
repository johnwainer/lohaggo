import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig, upsertProviderConfig } from '@/lib/messaging/provider-config'

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

function cachedTemplatesToResponse(cached: any[]) {
  return (cached ?? []).map((t: any) => ({
    sid: t.sid ?? `meta:${t.name}:${t.language}`,
    name: t.name,
    language: t.language ?? 'es_CO',
    types: ['twilio/text'],
    body: t.body ?? '',
    variables: t.variables ?? {},
    waStatus: t.waStatus ?? 'approved',
    waName: t.name,
    waCategory: t.waCategory ?? null,
    waRejectionReason: null,
    source: 'meta' as const,
  }))
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const runtimeConfig = await getMessagingProviderRuntimeConfig()

    const twilioTemplates: any[] = []
    // Use DB config if available, fall back to env vars (for local dev when DB decrypt fails)
    const conf = (runtimeConfig.twilio.config?.accountSid && runtimeConfig.twilio.config?.authToken)
      ? runtimeConfig.twilio.config
      : (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        ? { accountSid: process.env.TWILIO_ACCOUNT_SID, authToken: process.env.TWILIO_AUTH_TOKEN }
        : null
    if (conf?.accountSid && conf?.authToken) {
      try {
        const { accountSid, authToken } = conf
        const contentData = await twilioFetch('/v1/Content?PageSize=50', accountSid, authToken)
        await Promise.all(
          (contentData?.contents ?? []).map(async (c: any) => {
            try {
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
            } catch { /* skip this template on error */ }
          })
        )
      } catch { /* Twilio unavailable — continue */ }
    }

    const metaTemplates: any[] = []
    const metaConf = runtimeConfig.metaWhatsApp.config as any
    // Only load Meta templates when Meta is active — prevents hiding Twilio templates
    // and sending campaigns through a broken/unconfigured Meta provider
    if (runtimeConfig.metaWhatsApp.active && metaConf?.accessToken && metaConf?.wabaId) {
      try {
        const fetched = await fetchMetaTemplates(metaConf.accessToken, metaConf.wabaId)
        metaTemplates.push(...fetched)
      } catch { /* Meta API unavailable — continue */ }

      // Fall back to cached templates if live API returned nothing
      if (metaTemplates.length === 0 && Array.isArray(metaConf?.cachedTemplates)) {
        metaTemplates.push(...cachedTemplatesToResponse(metaConf.cachedTemplates))
      }
    }

    // Merge: Meta templates take precedence; skip Twilio duplicates by waName match
    const metaNames = new Set(metaTemplates.map((t) => t.waName))
    const filteredTwilio = twilioTemplates.filter((t) => !metaNames.has(t.waName))

    return NextResponse.json({ templates: [...metaTemplates, ...filteredTwilio] })
  } catch {
    return NextResponse.json({ templates: [] })
  }
}

// POST: update the Meta template cache stored in the META_WHATSAPP provider config
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { templates } = body
    if (!Array.isArray(templates)) {
      return NextResponse.json({ error: 'templates must be an array' }, { status: 400 })
    }

    const runtimeConfig = await getMessagingProviderRuntimeConfig()
    const existingConf = (runtimeConfig.metaWhatsApp.config ?? {}) as any

    const cachedTemplates = templates.map((t: any) => ({
      sid: t.sid ?? `meta:${t.name}:${t.language ?? 'es_CO'}`,
      name: t.name,
      language: t.language ?? 'es_CO',
      body: t.body ?? '',
      variables: t.variables ?? {},
      waStatus: t.waStatus ?? 'approved',
      waCategory: t.waCategory ?? null,
    }))

    await upsertProviderConfig({
      provider: 'META_WHATSAPP',
      isActive: runtimeConfig.metaWhatsApp.active,
      config: {
        ...existingConf,
        cachedTemplates,
      },
      updatedByEmail: admin.email,
    })

    return NextResponse.json({ ok: true, count: cachedTemplates.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
