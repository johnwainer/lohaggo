/**
 * When the writer and the editor do not agree after their rounds, Haggo decides instead of leaving the
 * piece waiting for a person. Hard rules first (nothing with a real block goes out; a rejected angle is
 * dropped); what is left is a judgment call the model makes with both sides in front of it.
 */
import type Anthropic from '@anthropic-ai/sdk'

export type ArbiterDecision = 'publish' | 'discard' | 'human'

export type ArbiterCase = {
  /** The editor's last verdict on this version */
  editorStatus: 'approved' | 'changes' | 'rejected' | 'failed' | null
  score: number | null
  minScore: number
  /** Guardrail issues that block (invented price, fake promo, banned topic…) */
  blocks: string[]
  /** A person asked for this version: it goes back to that person */
  requestedByPerson: boolean
}

/** What the rules alone decide, or null when it is a judgment call for the arbiter. */
export function arbiterPrecheck(c: ArbiterCase): { decision: ArbiterDecision; reason: string } | null {
  if (c.requestedByPerson) return { decision: 'human', reason: 'Una persona pidió esta versión: vuelve a esa persona' }
  if (c.blocks.length) return { decision: 'human', reason: `Tiene un bloqueo que no se publica sin una persona: ${c.blocks.slice(0, 2).join(' · ')}` }
  if (c.editorStatus === 'approved') return { decision: 'publish', reason: 'El editor la aprobó' }
  if (c.editorStatus === 'failed') return null
  if (c.editorStatus === 'rejected') return { decision: 'discard', reason: 'El editor rechazó el enfoque' }
  // Far below the bar: not worth publishing; the planner proposes another idea
  if (c.score != null && c.score < c.minScore - 2) return { decision: 'discard', reason: `Puntaje ${c.score}/10, muy por debajo del mínimo (${c.minScore})` }
  return null
}

export const ARBITER_TOOL: Anthropic.Tool = {
  name: 'decidir_pieza',
  description: 'Decide si la pieza se publica o se descarta.',
  input_schema: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['publicar', 'descartar'] },
      motivo: { type: 'string', description: 'Una o dos frases: por qué, citando lo que pesó.' },
    },
    required: ['decision', 'motivo'],
  },
}

export function arbiterSystem(brand: string) {
  return [
    `Eres Haggo, el director de ${brand}. Tu equipo de marketing tiene dos agentes: un redactor y un editor. Cuando no se ponen de acuerdo, decides tú, para que nada quede esperando a una persona.`,
    'Publica si la pieza es útil, clara y veraz: no inventa precios, promociones, garantías ni datos; no promete lo que la plataforma no hace; no tiene riesgo legal ni de reputación; y su llamado a la acción tiene sentido.',
    'No bloquean una publicación: preferencias de estilo, una nota algo por debajo del mínimo, detalles de los parámetros de seguimiento de los enlaces (los pone la plataforma) ni enlazar a la página de inicio en vez de a una página del servicio.',
    'Descarta si hay un error de hecho, una promesa falsa, un tono que daña la marca, o si es tan floja que no aporta nada: el agente propondrá otra idea.',
    'Responde solo con la herramienta decidir_pieza.',
  ].join('\n')
}

export function arbiterTask(p: { title: string; texts: string; editorSummary: string; editorAsks: string[]; score: number | null; minScore: number; writerRisks: string[]; warnings: string[] }) {
  return [
    `Pieza: «${p.title}»`,
    `Texto por canal:\n${p.texts}`,
    `Editor: ${p.score != null ? `${p.score}/10 (mínimo ${p.minScore})` : 'sin puntaje'} · ${p.editorSummary || 'sin resumen'}`,
    p.editorAsks.length ? `Lo que el editor sigue pidiendo:\n- ${p.editorAsks.join('\n- ')}` : 'El editor no dejó pedidos concretos.',
    p.writerRisks.length ? `Riesgos que marcó el redactor:\n- ${p.writerRisks.join('\n- ')}` : 'El redactor no marcó riesgos.',
    p.warnings.length ? `Avisos de las reglas (no bloquean):\n- ${p.warnings.join('\n- ')}` : '',
    'Decide: publicar o descartar.',
  ].filter(Boolean).join('\n\n')
}

export function parseArbiter(raw: unknown): { decision: 'publish' | 'discard'; reason: string } | null {
  const r = raw as { decision?: unknown; motivo?: unknown } | null
  if (!r || (r.decision !== 'publicar' && r.decision !== 'descartar')) return null
  return { decision: r.decision === 'publicar' ? 'publish' : 'discard', reason: typeof r.motivo === 'string' && r.motivo.trim() ? r.motivo.trim().slice(0, 500) : 'Sin motivo' }
}

/** Editor asks about link parameters are not the writer's job (the platform adds them): they never hold a piece. */
export function isLinkParamAsk(text: string) {
  return /\butm\b|par[aá]metros? (de seguimiento|del enlace|en el enlace|de la url)|seguimiento de (la )?campa[nñ]a|enlaces? (sin|con) par[aá]metros/i.test(text)
}
