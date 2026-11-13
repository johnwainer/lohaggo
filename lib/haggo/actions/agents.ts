import { prisma } from '@/lib/prisma'
import { postNote, resolveNote } from '@/lib/agents/bus'
import { MAX_BODY, MAX_TITLE } from '@/lib/agents/bus-core'
import { NOTE_KINDS, getAgent, isAgentKey, type NoteKind, type NoteTopic } from '@/lib/agents/registry'
import { done, parseId, parseText, requireObj, type HaggoActionDef } from '@/lib/haggo/actions/types'

/** Topics Haggo may use: the rest (new_guide, seo_guidance, answer) belong to the agents that produce them */
export const HAGGO_NOTE_TOPICS = ['content_request', 'idea_request', 'alert', 'question', 'learning'] as const satisfies readonly NoteTopic[]
type HaggoTopic = (typeof HAGGO_NOTE_TOPICS)[number]

type PostParams = { toAgent: string; topic: HaggoTopic; kind: NoteKind; title: string; body?: string }

const postNoteAction: HaggoActionDef<PostParams> = {
  id: 'agents.post_note',
  domain: 'ai_agents',
  risk: 'low',
  label: 'Dejar una nota a otro agente',
  hint: 'Deja una nota en el tablón dirigida a otro agente del equipo (clave del registro: inbox, marketing, ads, seo…; nunca haggo): una petición (content_request, idea_request), una pregunta, un aviso (alert) o un aprendizaje (learning). El agente la lee como dato, no como orden, y decide qué hacer. Úsala para pasar contexto que otro agente necesita (por ejemplo a marketing que un servicio no tiene socios hoy). Mira antes en la herramienta agentes qué recibe cada agente y qué notas ya hay abiertas.',
  schema: {
    type: 'object',
    properties: {
      toAgent: { type: 'string', description: 'Clave del agente destinatario según la herramienta agentes' },
      topic: { type: 'string', enum: [...HAGGO_NOTE_TOPICS] },
      kind: { type: 'string', enum: [...NOTE_KINDS] },
      title: { type: 'string', description: `Título claro (máximo ${MAX_TITLE} caracteres)` },
      body: { type: 'string', description: `Detalle opcional (máximo ${MAX_BODY} caracteres). Sin datos de contacto de personas.` },
    },
    required: ['toAgent', 'topic', 'kind', 'title'],
  },
  sideEffects: [],
  parse: (raw) => {
    const r = requireObj(raw)
    const e: string[] = []
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const toAgent = typeof r.toAgent === 'string' && isAgentKey(r.toAgent) ? r.toAgent : (e.push('toAgent: una clave del registro de agentes'), '')
    const topic = (HAGGO_NOTE_TOPICS as readonly unknown[]).includes(r.topic) ? (r.topic as HaggoTopic) : (e.push(`topic: uno de ${HAGGO_NOTE_TOPICS.join(', ')}`), 'alert' as HaggoTopic)
    const kind = (NOTE_KINDS as readonly unknown[]).includes(r.kind) ? (r.kind as NoteKind) : (e.push(`kind: uno de ${NOTE_KINDS.join(', ')}`), 'alert' as NoteKind)
    const title = parseText(r, 'title', e, { min: 5, max: MAX_TITLE }) as string
    const body = parseText(r, 'body', e, { max: MAX_BODY, optional: true })
    return done(e, { toAgent, topic, kind, title, ...(body ? { body } : {}) })
  },
  describe: (p) => `Dejar una nota a ${getAgent(p.toAgent)?.name ?? p.toAgent}: ${p.title}`,
  entity: (p) => ({ type: 'AgentNote', id: p.toAgent }),
  preconditions: async (p) => {
    const agent = getAgent(p.toAgent)
    if (!agent) return { ok: false, reason: 'El agente destinatario no existe' }
    if (agent.key === 'haggo') return { ok: false, reason: 'Una nota no puede ir a Haggo desde Haggo' }
    return { ok: true, before: { toAgent: agent.key, toName: agent.name } }
  },
  preview: async (p, before) => ({
    summary: `Se deja una nota (${p.topic}) a ${(before as { toName: string }).toName}: «${p.title}». La lee como dato en su próxima ejecución; no es una orden`,
    diff: [{ field: 'Nota', from: null, to: p.title }],
  }),
  execute: async (p) => {
    const r = await postNote({ fromAgent: 'haggo', toAgent: p.toAgent as never, topic: p.topic, kind: p.kind, title: p.title, body: p.body ?? null })
    if (!r.ok) throw new Error(r.error)
    return { after: { noteId: r.id || null, duplicate: Boolean(r.duplicate) }, result: r.duplicate ? 'Ya había una nota igual' : 'Nota dejada en el tablón' }
  },
  unchanged: async (_p, after) => {
    const id = (after as { noteId: string | null } | null)?.noteId
    if (!id) return false
    return (await prisma.agentNote.findUnique({ where: { id }, select: { status: true } }).catch(() => null))?.status === 'open'
  },
  undo: async (_p, _before, after) => {
    const a = after as { noteId: string | null; duplicate: boolean } | null
    if (!a?.noteId || a.duplicate) throw new Error('No se sabe qué nota se dejó: ciérrala a mano en el panel de agentes')
    const r = await prisma.agentNote.updateMany({ where: { id: a.noteId, status: 'open' }, data: { status: 'expired' } })
    if (!r.count) throw new Error('El agente ya atendió esa nota: no se puede deshacer')
  },
}

const resolveNoteAction: HaggoActionDef<{ noteId: string }> = {
  id: 'agents.resolve_note',
  domain: 'ai_agents',
  risk: 'low',
  label: 'Cerrar una nota del tablón dirigida a Haggo',
  hint: 'Marca como atendida una nota abierta del tablón que iba dirigida a Haggo (o a todos) cuando ya la revisaste y no queda nada por hacer. El noteId sale de la herramienta agentes. Se puede reabrir.',
  schema: { type: 'object', properties: { noteId: { type: 'string' } }, required: ['noteId'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { noteId: parseId(r, 'noteId', e) }) },
  describe: () => 'Cerrar una nota del tablón de agentes',
  entity: (p) => ({ type: 'AgentNote', id: p.noteId }),
  preconditions: async (p) => {
    const n = await prisma.agentNote.findUnique({ where: { id: p.noteId }, select: { title: true, status: true, toAgent: true, fromAgent: true } })
    if (!n) return { ok: false, reason: 'La nota no existe' }
    if (n.status !== 'open') return { ok: false, reason: 'La nota ya estaba cerrada o vencida' }
    if (n.toAgent !== 'haggo') return { ok: false, reason: n.toAgent ? 'La nota va dirigida a otro agente: la cierra él' : 'Es una nota para todos: cada agente la deja de ver al leerla, no se cierra' }
    return { ok: true, before: { title: n.title, status: n.status, fromAgent: n.fromAgent } }
  },
  preview: async (_p, before) => ({ summary: `La nota «${(before as { title: string }).title}» queda como atendida`, diff: [{ field: 'Estado', from: (before as { status: string }).status, to: 'atendida' }] }),
  execute: async (p) => {
    const ok = await resolveNote(p.noteId, 'haggo')
    if (!ok) throw new Error('No se pudo cerrar la nota (ya estaba cerrada o no existe)')
    return { after: { status: 'done' }, result: 'Nota cerrada' }
  },
  unchanged: async (p) => {
    const n = await prisma.agentNote.findUnique({ where: { id: p.noteId }, select: { status: true, resolvedBy: true } }).catch(() => null)
    return Boolean(n && n.status === 'done' && n.resolvedBy === 'haggo')
  },
  undo: async (p) => {
    const r = await prisma.agentNote.updateMany({ where: { id: p.noteId, status: 'done', resolvedBy: 'haggo' }, data: { status: 'open', resolvedAt: null, resolvedBy: null } })
    if (!r.count) throw new Error('La nota ya cambió: no se puede reabrir')
  },
}

export const AGENT_ACTIONS = [postNoteAction, resolveNoteAction] as unknown as HaggoActionDef[]
