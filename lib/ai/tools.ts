import type Anthropic from '@anthropic-ai/sdk'
import type { ConversationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { retrieve, type KnowledgeChunk } from '@/lib/ai/knowledge'
import { assertPublicHttpsUrl } from '@/lib/ai/net'

export type ToolName =
  | 'etiquetar_contacto'
  | 'guardar_dato'
  | 'cambiar_estado'
  | 'asignar_a_persona'
  | 'crear_tarea'
  | 'avisar_webhook'
  | 'buscar_en_conocimiento'
  | 'consultar_crm'

export const CRM_MODULES = {
  reservas: 'Reservas',
  solicitudes: 'Solicitudes de servicio',
  pagos: 'Pagos',
} as const
export type CrmModule = keyof typeof CRM_MODULES

type CatalogEntry = {
  label: string
  description: string
  /** When to use it and when not: tools get over-used unless the prompt says so. */
  guidance: string
  writes: boolean
  schema: (agent: ToolAgent) => Anthropic.Tool.InputSchema
}

export type ToolAgent = { id: string; name: string; tools: string[]; crmModules: string[]; webhookUrl: string | null }

const str = (description: string) => ({ type: 'string', description })

export const TOOL_CATALOG: Record<ToolName, CatalogEntry> = {
  etiquetar_contacto: {
    label: 'Etiquetar contacto',
    description: 'Añade una etiqueta a la conversación del contacto (p. ej. "interesado", "reclamo").',
    guidance: 'Úsala solo cuando el cliente muestre claramente una intención o situación que el equipo quiera filtrar después. No etiquetes en cada mensaje ni con etiquetas inventadas sin motivo.',
    writes: true,
    schema: () => ({ type: 'object', properties: { etiqueta: str('Etiqueta corta en minúsculas') }, required: ['etiqueta'], additionalProperties: false }),
  },
  guardar_dato: {
    label: 'Guardar dato',
    description: 'Guarda un dato que el cliente te dio (nombre, correo, ciudad, dirección…) en la ficha de la conversación.',
    guidance: 'Úsala cuando el cliente te dé explícitamente un dato útil. Nunca guardes datos que tú supones ni datos de pago.',
    writes: true,
    schema: () => ({ type: 'object', properties: { campo: str('Nombre del campo, p. ej. "correo"'), valor: str('Valor exacto que dio el cliente') }, required: ['campo', 'valor'], additionalProperties: false }),
  },
  cambiar_estado: {
    label: 'Cambiar estado',
    description: 'Cambia el estado de la conversación.',
    guidance: 'Marca "resuelta" solo cuando el cliente confirme que ya no necesita nada más. No cierres conversaciones con preguntas pendientes.',
    writes: true,
    schema: () => ({ type: 'object', properties: { estado: { type: 'string', enum: ['abierta', 'en_curso', 'resuelta', 'cerrada'] } }, required: ['estado'], additionalProperties: false }),
  },
  asignar_a_persona: {
    label: 'Asignar a una persona',
    description: 'Traspasa la conversación a una persona del equipo.',
    guidance: 'Úsala cuando el cliente pida hablar con una persona, cuando haya una queja seria o cuando la gestión requiera a alguien del equipo. No la uses para preguntas que puedes responder con el conocimiento.',
    writes: true,
    schema: () => ({ type: 'object', properties: { motivo: str('Motivo breve del traspaso para el equipo') }, required: ['motivo'], additionalProperties: false }),
  },
  crear_tarea: {
    label: 'Crear tarea',
    description: 'Crea una tarea de seguimiento para el equipo sobre este contacto.',
    guidance: 'Úsala cuando haya que hacer algo después (devolver una llamada, enviar una cotización). No la uses para cosas que resuelves en este mismo chat.',
    writes: true,
    schema: () => ({ type: 'object', properties: { titulo: str('Qué hay que hacer'), en_horas: { type: 'number', description: 'En cuántas horas vence (0 = sin fecha)' } }, required: ['titulo', 'en_horas'], additionalProperties: false }),
  },
  avisar_webhook: {
    label: 'Avisar por webhook',
    description: 'Envía un aviso con un resumen al sistema externo del negocio.',
    guidance: 'Úsala solo cuando se cumpla el objetivo o haya un dato que el negocio necesite recibir de inmediato. Una vez por hecho, no en cada mensaje.',
    writes: true,
    schema: () => ({ type: 'object', properties: { resumen: str('Resumen en una o dos frases'), datos: str('Datos relevantes en texto o JSON') }, required: ['resumen', 'datos'], additionalProperties: false }),
  },
  buscar_en_conocimiento: {
    label: 'Buscar en el conocimiento',
    description: 'Busca en la base de conocimiento del negocio.',
    guidance: 'Úsala cuando el conocimiento que ya tienes en el contexto no responde la pregunta. No la uses para saludos ni para preguntas que ya respondiste.',
    writes: false,
    schema: () => ({ type: 'object', properties: { pregunta: str('Qué quieres encontrar') }, required: ['pregunta'], additionalProperties: false }),
  },
  consultar_crm: {
    label: 'Consultar datos del cliente',
    description: 'Consulta los registros del cliente que atiendes (solo los suyos) en la plataforma.',
    guidance: 'Úsala cuando el cliente pregunte por sus reservas, solicitudes o pagos. Si un módulo responde "no disponible", di que no puedes consultarlo ahora; nunca afirmes que no tiene registros.',
    writes: false,
    schema: (agent) => ({
      type: 'object',
      properties: { modulo: { type: 'string', enum: agent.crmModules.filter((m) => m in CRM_MODULES) } },
      required: ['modulo'],
      additionalProperties: false,
    }),
  },
}

export const TOOL_NAMES = Object.keys(TOOL_CATALOG) as ToolName[]

/** Tool list in catalog order (stable → cacheable prefix). Only what the agent has in tools[]. */
export function agentToolNames(agent: ToolAgent): ToolName[] {
  return TOOL_NAMES.filter((n) => {
    if (!agent.tools.includes(n)) return false
    if (n === 'consultar_crm') return agent.crmModules.some((m) => m in CRM_MODULES)
    if (n === 'avisar_webhook') return Boolean(agent.webhookUrl)
    return true
  })
}

export function buildToolDefs(agent: ToolAgent, flowOutputs?: string[]): Anthropic.Tool[] {
  const defs: Anthropic.Tool[] = agentToolNames(agent).map((name) => ({
    name,
    description: TOOL_CATALOG[name].description,
    input_schema: TOOL_CATALOG[name].schema(agent),
    strict: true,
  }))
  if (flowOutputs?.length) {
    defs.push({
      name: 'elegir_salida',
      description: 'Elige por cuál salida continúa el flujo según lo que dijo el cliente.',
      input_schema: { type: 'object', properties: { salida: { type: 'string', enum: flowOutputs } }, required: ['salida'], additionalProperties: false },
      strict: true,
    })
  }
  return defs
}

export function toolGuidance(agent: ToolAgent, flowOutputs?: string[]) {
  const lines = agentToolNames(agent).map((n) => `- ${n}: ${TOOL_CATALOG[n].guidance}`)
  if (flowOutputs?.length) lines.push(`- elegir_salida: llámala exactamente una vez, cuando sepas por cuál de estas salidas sigue el flujo: ${flowOutputs.join(', ')}.`)
  return lines.join('\n')
}

// ─── Execution ──────────────────────────────────────────────────────────────

export type ToolRunState = {
  handoff: { reason: string } | null
  chosenOutput: string | null
  chunks: KnowledgeChunk[]
}

export type ToolContext = {
  agent: ToolAgent
  workspaceId: string
  conversationId: string | null
  /** Platform user linked to the conversation (for consultar_crm). */
  userId: string | null
  contact: { name: string | null; phone: string | null; channel: string }
  /** Playground: tools that write run dry; reads are real. */
  dryRun: boolean
  state: ToolRunState
}

export type ToolCallRecord = { name: string; input: Record<string, unknown>; output: string; dryRun: boolean; isError: boolean }

const STATUS_MAP: Record<string, ConversationStatus> = { abierta: 'OPEN', en_curso: 'IN_PROGRESS', resuelta: 'RESOLVED', cerrada: 'CLOSED' }

const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(d) : '—')
const fmtMoney = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`)

async function crmLookup(module: string, userId: string | null): Promise<string> {
  if (!(module in CRM_MODULES)) return `Módulo "${module}" no disponible.`
  if (!userId) return `${CRM_MODULES[module as CrmModule]}: no disponible (este contacto no está vinculado a un usuario de la plataforma).`
  try {
    if (module === 'reservas') {
      const rows = await prisma.booking.findMany({ where: { userId }, orderBy: { scheduledDate: 'desc' }, take: 10, select: { id: true, scheduledDate: true, scheduledTime: true, status: true, totalPrice: true, service: { select: { name: true } } } })
      if (!rows.length) return 'Reservas: el cliente no tiene reservas registradas.'
      return `Reservas (${rows.length} más recientes):\n${rows.map((r) => `• ${r.service.name} · ${fmtDate(r.scheduledDate)} ${r.scheduledTime} · estado ${r.status} · ${fmtMoney(r.totalPrice)} · ref ${r.id.slice(-6)}`).join('\n')}`
    }
    if (module === 'solicitudes') {
      const rows = await prisma.serviceRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, createdAt: true, preferredDate: true, service: { select: { name: true } } } })
      if (!rows.length) return 'Solicitudes: el cliente no tiene solicitudes registradas.'
      return `Solicitudes (${rows.length} más recientes):\n${rows.map((r) => `• ${r.service.name} · creada ${fmtDate(r.createdAt)} · preferida ${fmtDate(r.preferredDate)} · estado ${r.status} · ref ${r.id.slice(-6)}`).join('\n')}`
    }
    const rows = await prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, totalAmount: true, paidAt: true, createdAt: true, booking: { select: { service: { select: { name: true } } } } } })
    if (!rows.length) return 'Pagos: el cliente no tiene pagos registrados.'
    return `Pagos (${rows.length} más recientes):\n${rows.map((r) => `• ${r.booking?.service?.name ?? 'Servicio'} · ${fmtMoney(r.totalAmount)} · estado ${r.status} · ${r.paidAt ? `pagado ${fmtDate(r.paidAt)}` : `creado ${fmtDate(r.createdAt)}`} · ref ${r.id.slice(-6)}`).join('\n')}`
  } catch {
    // Never let a failed lookup read as "no records"
    return `${CRM_MODULES[module as CrmModule]}: no disponible en este momento.`
  }
}

async function runOne(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const s = (k: string) => String(input[k] ?? '').trim()
  const dry = ctx.dryRun
  const convId = ctx.conversationId

  switch (name) {
    case 'etiquetar_contacto': {
      const tag = s('etiqueta').toLowerCase().slice(0, 40)
      if (!tag) return 'Etiqueta vacía, no se aplicó.'
      if (!dry && convId) {
        const conv = await prisma.conversation.findUnique({ where: { id: convId }, select: { tags: true } })
        if (conv && !conv.tags.includes(tag)) await prisma.conversation.update({ where: { id: convId }, data: { tags: [...conv.tags, tag] } })
      }
      return `Etiqueta "${tag}" aplicada.`
    }
    case 'guardar_dato': {
      const field = s('campo').slice(0, 60)
      const value = s('valor').slice(0, 500)
      if (!field) return 'Campo vacío, no se guardó.'
      if (!dry && convId) {
        const conv = await prisma.conversation.findUnique({ where: { id: convId }, select: { customFields: true } })
        const current = (conv?.customFields && typeof conv.customFields === 'object' ? conv.customFields : {}) as Record<string, unknown>
        await prisma.conversation.update({ where: { id: convId }, data: { customFields: { ...current, [field]: value } as Prisma.InputJsonValue } })
      }
      return `Dato "${field}" guardado.`
    }
    case 'cambiar_estado': {
      const status = STATUS_MAP[s('estado')]
      if (!status) return 'Estado no válido.'
      if (!dry && convId) {
        await prisma.conversation.update({ where: { id: convId }, data: { status } })
        await prisma.conversationEvent.create({ data: { conversationId: convId, type: 'status', actorType: 'ai', actorId: ctx.agent.id, actorName: ctx.agent.name, detail: status } })
      }
      return `Estado cambiado a ${s('estado')}.`
    }
    case 'asignar_a_persona': {
      ctx.state.handoff = { reason: s('motivo') || 'Solicitado por el agente' }
      return 'Traspaso registrado: una persona del equipo continuará esta conversación. Despídete brevemente y avísale al cliente.'
    }
    case 'crear_tarea': {
      const title = s('titulo').slice(0, 200)
      const hours = Number(input.en_horas) || 0
      if (!title) return 'Título vacío, no se creó la tarea.'
      if (!dry && convId) {
        await prisma.conversationTask.create({
          data: { conversationId: convId, workspaceId: ctx.workspaceId, title, dueAt: hours > 0 ? new Date(Date.now() + hours * 3600_000) : null, source: 'ai', agentName: ctx.agent.name },
        })
      }
      return `Tarea creada: "${title}".`
    }
    case 'avisar_webhook': {
      const url = ctx.agent.webhookUrl
      if (!url || !/^https:\/\//.test(url)) return 'Webhook no configurado.'
      if (dry) return 'Aviso enviado (simulado en pruebas).'
      const target = await assertPublicHttpsUrl(url).catch(() => null)
      if (!target) return 'Webhook no permitido; sigue atendiendo al cliente con normalidad.'
      const res = await fetch(target, {
        redirect: 'manual',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'ai_agent_notice', agent: { id: ctx.agent.id, name: ctx.agent.name }, conversationId: convId, contact: ctx.contact, resumen: s('resumen'), datos: s('datos'), at: new Date().toISOString() }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)
      return res?.ok ? 'Aviso enviado.' : 'No se pudo enviar el aviso; sigue atendiendo al cliente con normalidad.'
    }
    case 'buscar_en_conocimiento': {
      const found = await retrieve({ workspaceId: ctx.workspaceId, agentId: ctx.agent.id, query: s('pregunta'), k: 4 })
      ctx.state.chunks.push(...found.chunks)
      if (!found.chunks.length) return 'No hay nada en el conocimiento sobre esto.'
      return found.chunks.map((c) => `[${c.title}]\n${c.text}`).join('\n\n---\n\n').slice(0, 8000)
    }
    case 'consultar_crm': {
      const module = s('modulo')
      if (!ctx.agent.crmModules.includes(module)) return `Módulo "${module}" no disponible para este agente.`
      return crmLookup(module, ctx.userId)
    }
    case 'elegir_salida': {
      ctx.state.chosenOutput = s('salida')
      return `Salida "${s('salida')}" elegida.`
    }
    default:
      return `Herramienta "${name}" no disponible.`
  }
}

export function isWriteTool(name: string) {
  return (TOOL_CATALOG as Record<string, CatalogEntry | undefined>)[name]?.writes ?? false
}

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolCallRecord> {
  const allowed = name === 'elegir_salida' || agentToolNames(ctx.agent).includes(name as ToolName)
  if (!allowed) return { name, input, output: `Herramienta "${name}" no disponible.`, dryRun: ctx.dryRun, isError: true }
  try {
    const output = await runOne(name, input, ctx)
    return { name, input, output, dryRun: ctx.dryRun && isWriteTool(name), isError: false }
  } catch (err) {
    return { name, input, output: `Error: ${err instanceof Error ? err.message : 'fallo'}`, dryRun: ctx.dryRun, isError: true }
  }
}
