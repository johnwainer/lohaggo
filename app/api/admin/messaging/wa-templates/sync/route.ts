import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig, upsertProviderConfig } from '@/lib/messaging/provider-config'

async function fetchMetaTemplates(accessToken: string, wabaId: string) {
  const url = `https://graph.facebook.com/v18.0/${wabaId}/message_templates?fields=name,language,status,category,components&limit=100&access_token=${accessToken}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()

  return (data?.data ?? []).map((t: any) => {
    const bodyComp = (t.components ?? []).find((c: any) => c.type === 'BODY')
    return {
      sid: `meta:${t.name}:${t.language}`,
      name: t.name,
      language: t.language,
      body: bodyComp?.text ?? '',
      variables: {},
      waStatus: (t.status ?? '').toLowerCase(),
      waCategory: t.category ?? null,
    }
  })
}

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const metaConf = runtimeConfig.metaWhatsApp.config as any

  if (!metaConf?.accessToken || !metaConf?.wabaId) {
    return NextResponse.json({ error: 'Meta WhatsApp no configurado' }, { status: 400 })
  }

  const templates = await fetchMetaTemplates(metaConf.accessToken, metaConf.wabaId)

  await upsertProviderConfig({
    provider: 'META_WHATSAPP',
    isActive: runtimeConfig.metaWhatsApp.active,
    config: { ...metaConf, cachedTemplates: templates },
    updatedByEmail: admin.email,
  })

  return NextResponse.json({ ok: true, count: templates.length, templates })
}
