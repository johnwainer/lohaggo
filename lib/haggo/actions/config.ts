import { cityLaunchStatus } from '@/lib/cities/launch'
import { notifyWaitlistOpened } from '@/lib/waitlist/notify'
import type { CityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CLAIMS, CLAIM_KEYS, isClaimKey, unbackedClaims, type ClaimKey } from '@/lib/public/claims'
import { getClaimState, getTrustFacts } from '@/lib/public/trust'
import { TOOL_NAMES } from '@/lib/ai/tools'
import { CITY_STATUSES, COMMISSION_MAX_RATE, getCommission, restoreAgentTools, setAgentTools, setCityStatus, setClaim, setCommission, validRate, type CommissionState } from '@/lib/ops/platform-config'
import { done, parseBool, parseId, requireObj, type Diff, type HaggoActionDef } from '@/lib/haggo/actions/types'

const onOff = (v: boolean) => (v ? 'encendida' : 'apagada')

const setClaimAction: HaggoActionDef<{ key: ClaimKey; enabled: boolean }> = {
  id: 'trust.set_claim',
  domain: 'config',
  risk: 'high',
  label: 'Encender o apagar una afirmación pública del sitio',
  hint: 'Enciende o apaga una afirmación pública (confianza o promoción). Nunca enciendas una que configuracion_plataforma marque como no respaldada; apagar una no respaldada es urgente. La key sale de configuracion_plataforma.',
  schema: { type: 'object', properties: { key: { type: 'string', enum: [...CLAIM_KEYS] }, enabled: { type: 'boolean' } }, required: ['key', 'enabled'] },
  sideEffects: ['customer_facing'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const key = typeof r.key === 'string' && isClaimKey(r.key) ? r.key : (e.push(`key: una de ${CLAIM_KEYS.join(', ')}`), 'trust_real_stats' as ClaimKey)
    return done(e, { key, enabled: parseBool(r, 'enabled', e) })
  },
  describe: (p) => `${p.enabled ? 'Encender' : 'Apagar'} «${CLAIMS[p.key].name}» en el sitio`,
  entity: (p) => ({ type: 'FeatureFlag', id: p.key }),
  preconditions: async (p) => {
    const state = await getClaimState()
    if (state[p.key] === p.enabled) return { ok: false, reason: p.enabled ? 'Ya está encendida' : 'Ya está apagada' }
    if (p.enabled) {
      const why = unbackedClaims({ ...state, [p.key]: true }, await getTrustFacts()).find((u) => u.key === p.key)
      if (why) return { ok: false, reason: `No está respaldada: ${why.why}. Encenderla sería publicidad engañosa.` }
    }
    return { ok: true, before: { enabled: state[p.key], name: CLAIMS[p.key].name } }
  },
  preview: async (p, before) => {
    const b = before as { enabled: boolean; name: string }
    return { summary: `«${b.name}» ${p.enabled ? 'aparece' : 'deja de aparecer'} en el sitio: ${CLAIMS[p.key].says}`, diff: [{ field: 'Afirmación', from: onOff(b.enabled), to: onOff(p.enabled) }] }
  },
  execute: async (p) => {
    await setClaim(p.key, p.enabled)
    return { after: { enabled: p.enabled }, result: p.enabled ? 'Encendida: el sitio la muestra en minutos' : 'Apagada: el sitio deja de mostrarla en minutos' }
  },
  unchanged: async (p) => (await getClaimState())[p.key] === p.enabled,
  undo: async (p) => { await setClaim(p.key, !p.enabled) },
}

type CommissionParams = { enabled?: boolean; clientRate?: number; partnerRate?: number }

function commissionDiff(b: CommissionState, p: CommissionParams): Diff {
  const d: Diff = []
  if (p.enabled !== undefined && p.enabled !== b.enabled) d.push({ field: 'Comisiones', from: onOff(b.enabled), to: onOff(p.enabled) })
  if (p.clientRate !== undefined && p.clientRate !== b.clientRate) d.push({ field: 'Comisión del cliente', from: `${b.clientRate} %`, to: `${p.clientRate} %` })
  if (p.partnerRate !== undefined && p.partnerRate !== b.partnerRate) d.push({ field: 'Comisión del socio', from: `${b.partnerRate} %`, to: `${p.partnerRate} %` })
  return d
}

const setCommissionAction: HaggoActionDef<CommissionParams> = {
  id: 'money.set_commission',
  domain: 'money',
  risk: 'high',
  label: 'Encender, apagar o cambiar las comisiones',
  hint: `Enciende o apaga las comisiones de la plataforma o cambia las tasas (porcentaje de 0 a ${COMMISSION_MAX_RATE}). Afecta el precio que paga el cliente y lo que recibe el socio en las reservas nuevas. Si la promoción «sin comisión» está encendida, apágala antes de encender comisiones.`,
  schema: { type: 'object', properties: { enabled: { type: 'boolean' }, clientRate: { type: 'number', minimum: 0, maximum: COMMISSION_MAX_RATE }, partnerRate: { type: 'number', minimum: 0, maximum: COMMISSION_MAX_RATE } } },
  sideEffects: ['changes_money', 'customer_facing'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const p: CommissionParams = {}
    if (r.enabled !== undefined) p.enabled = parseBool(r, 'enabled', e)
    for (const k of ['clientRate', 'partnerRate'] as const) {
      if (r[k] === undefined) continue
      if (validRate(r[k])) p[k] = r[k] as number
      else e.push(`${k}: porcentaje entre 0 y ${COMMISSION_MAX_RATE}`)
    }
    const extra = Object.keys(r).filter((k) => !['enabled', 'clientRate', 'partnerRate'].includes(k))
    if (extra.length) e.push(`Parámetros desconocidos: ${extra.join(', ')}`)
    if (p.enabled === undefined && p.clientRate === undefined && p.partnerRate === undefined) e.push('No hay nada que cambiar')
    return done(e, p)
  },
  describe: (p) => [p.enabled !== undefined ? (p.enabled ? 'Encender las comisiones' : 'Apagar las comisiones') : '', p.clientRate !== undefined ? `cliente ${p.clientRate} %` : '', p.partnerRate !== undefined ? `socio ${p.partnerRate} %` : ''].filter(Boolean).join(', '),
  entity: () => ({ type: 'PlatformConfig', id: 'commission' }),
  preconditions: async (p) => {
    const b = await getCommission()
    if (!b) return { ok: false, reason: 'No hay configuración de pagos' }
    if (!commissionDiff(b, p).length) return { ok: false, reason: 'La configuración ya es esa' }
    if (p.enabled === true && !b.enabled && (await getClaimState()).promo_no_commission) return { ok: false, reason: 'La promoción «Sin comisión de lanzamiento» está encendida: primero hay que apagarla (trust.set_claim) o sería falsa' }
    return { ok: true, before: b }
  },
  preview: async (p, before) => {
    const b = before as CommissionState
    const enabled = p.enabled ?? b.enabled
    return { summary: enabled ? `Reservas nuevas con comisión: cliente ${p.clientRate ?? b.clientRate} %, socio ${p.partnerRate ?? b.partnerRate} %` : 'Reservas nuevas sin comisión: el cliente paga el precio del socio y el socio recibe el 100 %', diff: commissionDiff(b, p) }
  },
  execute: async (p) => {
    await setCommission(p)
    const after = await getCommission()
    return { after, result: 'Configuración de comisiones actualizada: aplica a las reservas nuevas' }
  },
  unchanged: async (_p, after) => {
    const now = await getCommission()
    const a = after as CommissionState | null
    return Boolean(now && a && now.enabled === a.enabled && now.clientRate === a.clientRate && now.partnerRate === a.partnerRate)
  },
  undo: async (_p, before) => {
    const b = before as CommissionState
    await setCommission({ enabled: b.enabled, clientRate: b.clientRate, partnerRate: b.partnerRate })
  },
}

const CITY_LABEL: Record<CityStatus, string> = { ACTIVE: 'activa', COMING_SOON: 'próximamente', INACTIVE: 'inactiva' }

const setCityAction: HaggoActionDef<{ slug: string; status: CityStatus }> = {
  id: 'config.set_city_status',
  domain: 'config',
  risk: 'high',
  label: 'Cambiar el estado de una ciudad',
  hint: 'Pasa una ciudad a activa (recibe solicitudes), próximamente (el sitio la anuncia) o inactiva. El slug sale de configuracion_plataforma. Activar exige la cobertura mínima de apertura_ciudad y, al activarse, avisa a su lista de espera (WhatsApp con autorización o correo).',
  schema: { type: 'object', properties: { slug: { type: 'string' }, status: { type: 'string', enum: [...CITY_STATUSES] } }, required: ['slug', 'status'] },
  sideEffects: ['customer_facing', 'notifies_customers'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const slug = typeof r.slug === 'string' && /^[a-z0-9-]{2,60}$/.test(r.slug) ? r.slug : (e.push('slug: el de la ciudad (configuracion_plataforma)'), '')
    const status = CITY_STATUSES.includes(r.status as CityStatus) ? (r.status as CityStatus) : (e.push('status: ACTIVE, COMING_SOON o INACTIVE'), 'INACTIVE' as CityStatus)
    return done(e, { slug, status })
  },
  describe: (p) => `Poner la ciudad ${p.slug} en ${CITY_LABEL[p.status]}`,
  entity: (p) => ({ type: 'CityConfig', id: p.slug }),
  preconditions: async (p) => {
    const c = await prisma.cityConfig.findUnique({ where: { slug: p.slug }, select: { name: true, status: true } })
    if (!c) return { ok: false, reason: 'La ciudad no existe' }
    if (c.status === p.status) return { ok: false, reason: `Ya está ${CITY_LABEL[p.status]}` }
    if (p.status === 'ACTIVE') {
      const launch = await cityLaunchStatus(p.slug)
      if (!launch?.supported) return { ok: false, reason: `${c.name} todavía no existe como ciudad de servicio en la plataforma (hace falta un cambio de código)` }
      if (!launch.ready) return { ok: false, reason: `Falta cobertura: ${launch.checks.filter((x) => !x.ok && !x.item.startsWith('Gente')).map((x) => `${x.item} (${x.detail})`).join('; ')}` }
    }
    return { ok: true, before: { name: c.name, status: c.status } }
  },
  preview: async (p, before) => {
    const b = before as { name: string; status: CityStatus }
    const what = p.status === 'ACTIVE' ? 'recibe solicitudes y aparece en el sitio' : p.status === 'COMING_SOON' ? 'aparece como «próximamente» y no recibe solicitudes' : 'deja de aparecer y de recibir solicitudes'
    return { summary: `${b.name} ${what}`, diff: [{ field: 'Estado', from: CITY_LABEL[b.status], to: CITY_LABEL[p.status] }] }
  },
  execute: async (p) => {
    await setCityStatus(p.slug, p.status)
    if (p.status !== 'ACTIVE') return { after: { status: p.status }, result: `Ciudad ${CITY_LABEL[p.status]}` }
    // Opened: the people who asked to be told hear it now
    const sent = await notifyWaitlistOpened(p.slug).catch(() => null)
    return { after: { status: p.status }, result: `Ciudad activa${sent ? ` · lista de espera avisada: ${sent.whatsapp} por WhatsApp, ${sent.email} por correo${sent.failed ? `, ${sent.failed} sin enviar` : ''}` : ' · no se pudo avisar a la lista de espera (hazlo desde Admin → Lista de espera)'}` }
  },
  unchanged: async (p) => (await prisma.cityConfig.findUnique({ where: { slug: p.slug }, select: { status: true } }))?.status === p.status,
  undo: async (p, before) => { await setCityStatus(p.slug, (before as { status: CityStatus }).status) },
}

type ToolsParams = { agentId: string; add: string[]; remove: string[] }

function parseToolList(r: Record<string, unknown>, key: 'add' | 'remove', e: string[]) {
  const v = r[key]
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > TOOL_NAMES.length || !v.every((t) => typeof t === 'string')) { e.push(`${key}: lista de nombres de herramientas`); return [] }
  const known = new Set<string>(TOOL_NAMES)
  const bad = (v as string[]).filter((t) => !known.has(t))
  if (bad.length) e.push(`${key}: herramientas desconocidas (${bad.join(', ')})`)
  return Array.from(new Set(v as string[]))
}

const setToolsAction: HaggoActionDef<ToolsParams> = {
  id: 'ai_agents.set_tools',
  domain: 'ai_agents',
  risk: 'high',
  label: 'Activar o desactivar herramientas de un agente de la bandeja',
  hint: 'Agrega o quita herramientas a un agente de IA de la bandeja (por ejemplo, un grupo completo de Operación por chat). Mira antes en agente_ia qué tiene activo y qué no; el agentId sale de la foto (aiAgents).',
  schema: { type: 'object', properties: { agentId: { type: 'string' }, add: { type: 'array', items: { type: 'string', enum: [...TOOL_NAMES] } }, remove: { type: 'array', items: { type: 'string', enum: [...TOOL_NAMES] } } }, required: ['agentId'] },
  sideEffects: ['customer_facing'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const p = { agentId: parseId(r, 'agentId', e), add: parseToolList(r, 'add', e), remove: parseToolList(r, 'remove', e) }
    if (!p.add.length && !p.remove.length) e.push('No hay herramientas que agregar ni quitar')
    if (p.add.some((t) => p.remove.includes(t))) e.push('Una herramienta no puede agregarse y quitarse a la vez')
    return done(e, p)
  },
  describe: (p) => [p.add.length ? `Activar ${p.add.join(', ')}` : '', p.remove.length ? `desactivar ${p.remove.join(', ')}` : ''].filter(Boolean).join('; '),
  entity: (p) => ({ type: 'AiAgent', id: p.agentId }),
  preconditions: async (p) => {
    const a = await prisma.aiAgent.findUnique({ where: { id: p.agentId }, select: { name: true, tools: true } })
    if (!a) return { ok: false, reason: 'El agente no existe' }
    const add = p.add.filter((t) => !a.tools.includes(t))
    const remove = p.remove.filter((t) => a.tools.includes(t))
    if (!add.length && !remove.length) return { ok: false, reason: 'El agente ya tiene exactamente esas herramientas así' }
    return { ok: true, before: { name: a.name, tools: a.tools } }
  },
  preview: async (p, before) => {
    const b = before as { name: string; tools: string[] }
    const add = p.add.filter((t) => !b.tools.includes(t))
    const remove = p.remove.filter((t) => b.tools.includes(t))
    return {
      summary: `${b.name}: ${[add.length ? `gana ${add.length} herramienta${add.length === 1 ? '' : 's'}` : '', remove.length ? `pierde ${remove.length}` : ''].filter(Boolean).join(' y ')}; aplica desde el próximo mensaje`,
      diff: [...(add.length ? [{ field: 'Activar', from: '—', to: add.join(', ') }] : []), ...(remove.length ? [{ field: 'Desactivar', from: remove.join(', '), to: '—' }] : [])],
    }
  },
  execute: async (p) => {
    const r = await setAgentTools(p.agentId, { add: p.add, remove: p.remove })
    return { after: { tools: r.tools }, result: 'Herramientas actualizadas: aplican desde el próximo mensaje' }
  },
  unchanged: async (p, after) => {
    const a = await prisma.aiAgent.findUnique({ where: { id: p.agentId }, select: { tools: true } })
    const want = (after as { tools: string[] }).tools
    return Boolean(a && a.tools.length === want.length && want.every((t) => a.tools.includes(t)))
  },
  undo: async (p, before) => { await restoreAgentTools(p.agentId, (before as { tools: string[] }).tools) },
}

export const CONFIG_ACTIONS = [setClaimAction, setCommissionAction, setCityAction, setToolsAction] as unknown as HaggoActionDef[]
