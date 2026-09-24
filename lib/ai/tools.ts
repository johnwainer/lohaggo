import type Anthropic from '@anthropic-ai/sdk'
import type { ConversationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { retrieve, type KnowledgeChunk } from '@/lib/ai/knowledge'
import { assertPublicHttpsUrl } from '@/lib/ai/net'
import { CATALOG_TOPICS, CRM_MODULES, catalogLookup, crmLookup } from '@/lib/ai/platform-data'
import { ACCESS_LINK_TTL_HOURS, createAccountFromContact, emailAccessLink, emailProviderReady, validateAccountInput } from '@/lib/accounts/from-contact'
import { maskEmail } from '@/lib/ai/platform-data'

/** Account-creation attempts an AI agent may make per conversation per day (anti-abuse). */
export const MAX_ACCOUNT_ATTEMPTS_PER_DAY = 3
/** One wording for every failure: the chat must not learn whether an email is registered. */
export const ACCOUNT_TOOL_FAILURE = 'No se pudo crear la cuenta con esos datos. La persona puede registrarse en lohaggo.com/register o, si ya tiene cuenta, entrar con "Olvidé mi contraseña". Si insiste o no puede, pasa el caso a una persona.'

export { CRM_MODULES }
export type { CrmModule } from '@/lib/ai/platform-data'

export type ToolName =
  | 'etiquetar_contacto'
  | 'guardar_dato'
  | 'cambiar_estado'
  | 'asignar_a_persona'
  | 'crear_tarea'
  | 'avisar_webhook'
  | 'buscar_en_conocimiento'
  | 'consultar_crm'
  | 'consultar_catalogo'
  | 'crear_cuenta_cliente'

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
  consultar_catalogo: {
    label: 'Consultar catálogo de la plataforma',
    description: 'Consulta datos públicos de LoHaggo: servicios disponibles con precio base, duración y cuántos socios verificados los ofrecen; ciudades activas y próximas; medios de pago habilitados y tarifas.',
    guidance: 'Úsala cuando pregunten qué servicios hay, cuánto cuesta un servicio, en qué ciudades operamos o cómo se puede pagar. Para un servicio concreto usa tema "servicios" y escribe el nombre en busqueda; para todo el catálogo deja busqueda vacía. El precio base es un "desde": el precio final lo pone el socio en su propuesta.',
    writes: false,
    schema: () => ({
      type: 'object',
      properties: { tema: { type: 'string', enum: [...CATALOG_TOPICS] }, busqueda: str('Palabra del servicio buscado, o vacío para todo') },
      required: ['tema', 'busqueda'],
      additionalProperties: false,
    }),
  },
  crear_cuenta_cliente: {
    label: 'Crear cuenta de cliente',
    description: 'Crea la cuenta de cliente en LoHaggo de la persona con la que hablas y le envía a su correo un enlace para crear su contraseña.',
    guidance: 'Úsala solo cuando la persona quiera registrarse o necesite cuenta para pedir un servicio, después de pedirle su nombre completo y su correo y confirmarle el correo leyéndoselo. Nunca la uses si consultar datos del usuario muestra que ya tiene cuenta, ni para crear cuentas de otras personas ni de socios (a quien quiera ser socio, envíalo a lohaggo.com/unete). El enlace de acceso llega a su correo, no al chat: dile que revise su bandeja de entrada y spam, y que vence en ' + ACCESS_LINK_TTL_HOURS + ' horas. Nunca inventes ni pidas un enlace. Si la herramienta dice que no se pudo, repite exactamente la alternativa que te da.',
    writes: true,
    schema: () => ({
      type: 'object',
      properties: { nombre: str('Nombre completo de la persona'), correo: str('Correo que la persona confirmó') },
      required: ['nombre', 'correo'],
      additionalProperties: false,
    }),
  },
  consultar_crm: {
    label: 'Consultar datos del usuario',
    description: 'Consulta los datos en la plataforma de la persona que atiendes (solo los suyos): su cuenta y, como cliente, reservas, solicitudes y pagos; como socio, estado de verificación, documentos, servicios, reservas, propuestas y pagos.',
    guidance: 'Úsala cuando la persona pregunte por algo de su cuenta, sus reservas, solicitudes, pagos o, si es socio, su verificación, documentos, servicios, propuestas o pagos. Elige el módulo que responde la pregunta; no consultes módulos que no hacen falta. Si responde "no disponible", di que no puedes consultarlo ahora; nunca afirmes que no tiene registros. Si responde que no es socio, trátala como cliente o aspirante.',
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
    case 'consultar_catalogo': {
      return catalogLookup(s('tema'), s('busqueda'))
    }
    case 'crear_cuenta_cliente': {
      const check = validateAccountInput({ name: s('nombre'), email: s('correo'), role: 'CLIENT' })
      if (!check.ok) return `No se creó la cuenta: ${check.error}. Pídele el dato correcto.`
      if (dry) return `Cuenta de cliente creada para ${check.name} — simulado en pruebas. En producción el enlace de acceso llega al correo ${maskEmail(check.email)}.`
      if (!convId) return ACCOUNT_TOOL_FAILURE
      const conv = await prisma.conversation.findUnique({ where: { id: convId }, select: { contactId: true } })
      if (!conv?.contactId) return ACCOUNT_TOOL_FAILURE
      // Anti-abuse: a few attempts per conversation per day, each one visible to the team in the thread
      const attempts = await prisma.conversationEvent.count({ where: { conversationId: convId, type: 'account_attempt', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })
      if (attempts >= MAX_ACCOUNT_ATTEMPTS_PER_DAY) return ACCOUNT_TOOL_FAILURE
      await prisma.conversationEvent.create({ data: { conversationId: convId, type: 'account_attempt', actorType: 'ai', actorId: ctx.agent.id, actorName: ctx.agent.name, detail: maskEmail(check.email) } })
      // The link goes to the email (proof of ownership), so without email delivery nothing is created
      if (!(await emailProviderReady())) return ACCOUNT_TOOL_FAILURE
      const result = await createAccountFromContact({
        contactId: conv.contactId, role: 'CLIENT', name: check.name, email: check.email,
        createdBy: { type: 'ai', id: ctx.agent.id, name: ctx.agent.name },
      })
      if (!result.ok) {
        if (result.code === 'already_linked') return 'Esta persona ya tiene una cuenta en LoHaggo (está vinculada a esta conversación). Dile que entre en lohaggo.com; si no recuerda la contraseña, que use "Olvidé mi contraseña".'
        return ACCOUNT_TOOL_FAILURE
      }
      const mail = await emailAccessLink(check.email, check.name, 'CLIENT', result.accessUrl)
      if (!mail.ok) return `La cuenta se creó, pero no se pudo enviar el correo con el enlace. Dile que entre en lohaggo.com con "Olvidé mi contraseña" usando ${maskEmail(check.email)}.`
      return `Cuenta de cliente creada para ${check.name}. Le enviamos al correo ${maskEmail(check.email)} el enlace para crear su contraseña (vence en ${ACCESS_LINK_TTL_HOURS} horas). Dile que revise su bandeja de entrada y spam.`
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
