import { prisma } from '@/lib/prisma'
import { setAiAgentStatus, updateAgentInstructions, INSTRUCTION_FIELDS, type InstructionFields } from '@/lib/ai/agent-ops'
import { answerOpenGap, reindexKnowledge, reopenGap } from '@/lib/ai/knowledge'
import { assignToAi, assignToPerson, isValidAssignee } from '@/lib/inbox/ai-assign'
import { done, parseId, parseText, requireObj, type HaggoActionDef } from '@/lib/haggo/actions/types'

function agentStatus(id: string, status: 'active' | 'paused'): HaggoActionDef<{ agentId: string }> {
  const pausing = status === 'paused'
  return {
    id: pausing ? 'ai_agents.pause' : 'ai_agents.activate',
    domain: 'ai_agents',
    risk: 'medium',
    label: pausing ? 'Pausar un agente de IA de la bandeja' : 'Reactivar un agente de IA de la bandeja',
    hint: pausing ? 'Deja de responder; sus conversaciones abiertas pasan a personas con prioridad alta.' : 'Vuelve a responder conversaciones nuevas.',
    schema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] },
    sideEffects: [],
    parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { agentId: parseId(r, 'agentId', e) }) },
    describe: () => (pausing ? 'Pausar el agente y pasar sus conversaciones a personas' : 'Reactivar el agente'),
    entity: (p) => ({ type: 'AiAgent', id: p.agentId }),
    preconditions: async (p) => {
      const a = await prisma.aiAgent.findUnique({ where: { id: p.agentId }, select: { name: true, status: true } })
      if (!a) return { ok: false, reason: 'El agente no existe' }
      if (a.status === status) return { ok: false, reason: pausing ? 'Ya está pausado' : 'Ya está activo' }
      const open = pausing ? await prisma.conversation.count({ where: { aiAgentId: p.agentId, aiHandled: true, status: { in: ['OPEN', 'IN_PROGRESS'] } } }) : 0
      return { ok: true, before: { name: a.name, status: a.status, open } }
    },
    preview: async (_p, before) => {
      const b = before as { name: string; status: string; open: number }
      return {
        summary: pausing ? `${b.name} deja de responder${b.open ? `; ${b.open} conversaciones abiertas pasan a personas` : ''}` : `${b.name} vuelve a responder`,
        diff: [{ field: 'Estado', from: b.status === 'active' ? 'activo' : 'pausado', to: pausing ? 'pausado' : 'activo' }, ...(b.open ? [{ field: 'Conversaciones con IA', from: b.open, to: 0 }] : [])],
      }
    },
    execute: async (p) => {
      const r = await setAiAgentStatus(p.agentId, status)
      return { after: { status }, result: pausing ? `Pausado; ${r.released.length} conversaciones pasaron a personas` : 'Activo' }
    },
    unchanged: async (p) => (await prisma.aiAgent.findUnique({ where: { id: p.agentId }, select: { status: true } }))?.status === status,
    undo: async (p) => { await setAiAgentStatus(p.agentId, pausing ? 'active' : 'paused') },
  }
}

const instructions: HaggoActionDef<{ agentId: string } & InstructionFields> = {
  id: 'ai_agents.update_instructions',
  domain: 'ai_agents',
  risk: 'high',
  label: 'Cambiar las instrucciones de un agente de IA',
  hint: 'Reescribe instrucciones, objetivo o tono. Manda el texto completo nuevo de cada campo que cambies (no un fragmento).',
  schema: { type: 'object', properties: { agentId: { type: 'string' }, instructions: { type: 'string' }, goal: { type: 'string' }, tone: { type: 'string' } }, required: ['agentId'] },
  sideEffects: ['customer_facing'],
  parse: (raw) => {
    const r = requireObj(raw)
    if (!r) return { ok: false, errors: ['Parámetros inválidos'] }
    const e: string[] = []
    const p: { agentId: string } & InstructionFields = { agentId: parseId(r, 'agentId', e) }
    const max = { instructions: 12_000, goal: 1000, tone: 200 }
    for (const k of INSTRUCTION_FIELDS) { const v = parseText(r, k, e, { max: max[k], optional: true }); if (v !== undefined) p[k] = v }
    if (!INSTRUCTION_FIELDS.some((k) => p[k] !== undefined)) e.push('No hay ningún campo que cambiar')
    return done(e, p)
  },
  describe: (p) => `Cambiar ${INSTRUCTION_FIELDS.filter((k) => p[k] !== undefined).map((k) => ({ instructions: 'las instrucciones', goal: 'el objetivo', tone: 'el tono' })[k]).join(', ')} del agente`,
  entity: (p) => ({ type: 'AiAgent', id: p.agentId }),
  preconditions: async (p) => {
    const a = await prisma.aiAgent.findUnique({ where: { id: p.agentId }, select: { name: true, instructions: true, goal: true, tone: true } })
    if (!a) return { ok: false, reason: 'El agente no existe' }
    const changed = INSTRUCTION_FIELDS.filter((k) => p[k] !== undefined && p[k] !== (a[k] ?? ''))
    if (!changed.length) return { ok: false, reason: 'El texto propuesto es igual al actual' }
    return { ok: true, before: { name: a.name, instructions: a.instructions ?? '', goal: a.goal ?? '', tone: a.tone ?? '' } }
  },
  preview: async (p, before) => {
    const b = before as Record<string, string>
    const diff = INSTRUCTION_FIELDS.filter((k) => p[k] !== undefined && p[k] !== b[k]).map((k) => ({ field: { instructions: 'Instrucciones', goal: 'Objetivo', tone: 'Tono' }[k], from: b[k], to: p[k] }))
    return { summary: `${b.name}: cambian ${diff.map((d) => d.field.toLowerCase()).join(', ')}`, diff }
  },
  execute: async (p) => {
    const fields = Object.fromEntries(INSTRUCTION_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) as InstructionFields
    await updateAgentInstructions(p.agentId, fields)
    return { after: fields, result: 'Instrucciones actualizadas: aplican desde el próximo mensaje' }
  },
  unchanged: async (p, after) => {
    const a = await prisma.aiAgent.findUnique({ where: { id: p.agentId }, select: { instructions: true, goal: true, tone: true } })
    const want = after as InstructionFields
    return Boolean(a && Object.entries(want).every(([k, v]) => (a[k as keyof typeof a] ?? '') === v))
  },
  undo: async (p, before) => {
    const b = before as Record<string, string>
    await updateAgentInstructions(p.agentId, Object.fromEntries(INSTRUCTION_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, b[k]])) as InstructionFields)
  },
}

const answerGap: HaggoActionDef<{ gapId: string; answer: string; title?: string }> = {
  id: 'ai_agents.answer_gap',
  domain: 'ai_agents',
  risk: 'high',
  label: 'Responder una pregunta que los agentes no sabían',
  hint: 'Crea un documento de conocimiento con la respuesta a un vacío abierto. Solo con datos verificados de la plataforma: los clientes leerán esta respuesta.',
  schema: { type: 'object', properties: { gapId: { type: 'string' }, answer: { type: 'string' }, title: { type: 'string' } }, required: ['gapId', 'answer'] },
  sideEffects: ['customer_facing'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { gapId: parseId(r, 'gapId', e), answer: parseText(r, 'answer', e, { min: 20, max: 4000 }) as string, title: parseText(r, 'title', e, { max: 120, optional: true }) }) },
  describe: () => 'Responder el vacío de conocimiento',
  entity: (p) => ({ type: 'AiKnowledgeGap', id: p.gapId }),
  preconditions: async (p) => {
    const g = await prisma.aiKnowledgeGap.findUnique({ where: { id: p.gapId }, select: { status: true, question: true } })
    if (!g) return { ok: false, reason: 'El vacío no existe' }
    if (g.status !== 'open') return { ok: false, reason: 'El vacío ya no está abierto' }
    return { ok: true, before: { question: g.question.slice(0, 500) } }
  },
  preview: async (p, before) => ({ summary: `Respuesta nueva al conocimiento de los agentes`, diff: [{ field: 'Pregunta', from: (before as { question: string }).question, to: p.answer }] }),
  execute: async (p, ctx) => {
    const doc = await answerOpenGap({ gapId: p.gapId, answer: p.answer, title: p.title, createdByEmail: `Haggo (aprobado por ${ctx.approverEmail ?? 'superadmin'})` })
    return { after: { docId: doc.id }, result: 'Documento creado e indexado: los agentes ya lo usan' }
  },
  unchanged: async (_p, after) => Boolean(await prisma.aiKnowledgeDoc.findUnique({ where: { id: (after as { docId: string }).docId }, select: { id: true } })),
  undo: async (p, _b, after) => reopenGap(p.gapId, (after as { docId: string }).docId),
}

const reindex: HaggoActionDef<{ workspaceId: string; agentId?: string }> = {
  id: 'ai_agents.reindex_knowledge',
  domain: 'ai_agents',
  risk: 'low',
  label: 'Reindexar el conocimiento',
  hint: 'Vuelve a procesar los documentos de conocimiento de una cuenta (o solo los de un agente), por ejemplo tras un fallo de Voyage.',
  schema: { type: 'object', properties: { workspaceId: { type: 'string' }, agentId: { type: 'string' } }, required: ['workspaceId'] },
  sideEffects: ['spends'],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { workspaceId: parseId(r, 'workspaceId', e), ...(r.agentId != null ? { agentId: parseId(r, 'agentId', e) } : {}) }) },
  describe: (p) => (p.agentId ? 'Reindexar el conocimiento del agente' : 'Reindexar el conocimiento de la cuenta'),
  entity: (p) => ({ type: 'Workspace', id: p.workspaceId }),
  preconditions: async (p) => {
    const n = await prisma.aiKnowledgeDoc.count({ where: { workspaceId: p.workspaceId } })
    if (!n) return { ok: false, reason: 'La cuenta no tiene documentos de conocimiento' }
    return { ok: true, before: { docs: n } }
  },
  preview: async (_p, before) => ({ summary: `Se vuelven a procesar hasta ${(before as { docs: number }).docs} documentos`, diff: [] }),
  execute: async (p) => ({ after: null, result: `${await reindexKnowledge(p.workspaceId, p.agentId)} documentos reindexados` }),
}

const assign: HaggoActionDef<{ conversationId: string; userId: string }> = {
  id: 'inbox.assign_conversation',
  domain: 'inbox',
  risk: 'low',
  label: 'Asignar una conversación a una persona',
  hint: 'Pasa una conversación estancada a una persona del equipo (miembro activo de la cuenta). La IA deja de responderla.',
  schema: { type: 'object', properties: { conversationId: { type: 'string' }, userId: { type: 'string', description: 'id del usuario admin que la atenderá' } }, required: ['conversationId', 'userId'] },
  sideEffects: [],
  parse: (raw) => { const r = requireObj(raw); const e: string[] = []; if (!r) return { ok: false, errors: ['Parámetros inválidos'] }; return done(e, { conversationId: parseId(r, 'conversationId', e), userId: parseId(r, 'userId', e) }) },
  describe: () => 'Asignar la conversación a una persona',
  entity: (p) => ({ type: 'Conversation', id: p.conversationId }),
  preconditions: async (p) => {
    const c = await prisma.conversation.findUnique({ where: { id: p.conversationId }, select: { workspaceId: true, status: true, assignedToId: true, aiHandled: true, aiAgentId: true, channel: true } })
    if (!c) return { ok: false, reason: 'La conversación no existe' }
    if (!['OPEN', 'IN_PROGRESS'].includes(c.status)) return { ok: false, reason: 'La conversación está cerrada' }
    if (c.assignedToId === p.userId) return { ok: false, reason: 'Ya está asignada a esa persona' }
    if (!(await isValidAssignee(c.workspaceId, p.userId))) return { ok: false, reason: 'Esa persona no puede atender conversaciones de esta cuenta' }
    const who = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true } })
    return { ok: true, before: { assignedToId: c.assignedToId, aiHandled: c.aiHandled, aiAgentId: c.aiAgentId, channel: c.channel, to: who?.name ?? 'persona' } }
  },
  preview: async (_p, before) => {
    const b = before as { aiHandled: boolean; assignedToId: string | null; channel: string; to: string }
    return { summary: `Conversación de ${b.channel} pasa a ${b.to}`, diff: [{ field: 'Atiende', from: b.aiHandled ? 'IA' : b.assignedToId ? 'otra persona' : 'nadie', to: b.to }] }
  },
  execute: async (p, ctx) => {
    const c = await prisma.conversation.findUnique({ where: { id: p.conversationId } })
    if (!c) throw new Error('La conversación no existe')
    await assignToPerson(c, { id: ctx.approverId, name: 'Haggo' }, p.userId)
    return { after: { assignedToId: p.userId }, result: 'Asignada' }
  },
  unchanged: async (p) => (await prisma.conversation.findUnique({ where: { id: p.conversationId }, select: { assignedToId: true } }))?.assignedToId === p.userId,
  undo: async (p, before, _after) => {
    const b = before as { assignedToId: string | null; aiHandled: boolean; aiAgentId: string | null }
    const c = await prisma.conversation.findUnique({ where: { id: p.conversationId } })
    if (!c) throw new Error('La conversación no existe')
    const actor = { id: 'haggo', name: 'Haggo' }
    // assignToAi only hands it back: the agent answers when the customer writes again (no automatic reply here)
    if (b.aiHandled && b.aiAgentId) {
      const r = await assignToAi(c, actor, b.aiAgentId)
      if (!r.ok) throw new Error('No se pudo devolver a la IA')
    } else await assignToPerson(c, actor, b.assignedToId)
  },
}

export const AI_ACTIONS = [agentStatus('pause', 'paused'), agentStatus('activate', 'active'), instructions, answerGap, reindex, assign] as unknown as HaggoActionDef[]
