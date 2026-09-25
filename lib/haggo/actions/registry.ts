import type Anthropic from '@anthropic-ai/sdk'
import { DOMAINS, type Domain } from '@/lib/haggo/config'
import { MARKETING_ACTIONS } from '@/lib/haggo/actions/marketing'
import { AI_ACTIONS } from '@/lib/haggo/actions/ai'
import { PLATFORM_ACTIONS } from '@/lib/haggo/actions/platform'
import { RISK_LABEL, SIDE_EFFECT_LABEL, type HaggoActionDef } from '@/lib/haggo/actions/types'

/** Everything Haggo can do. The only place ids, risks and side effects are defined. */
export const ACTIONS: HaggoActionDef[] = [...MARKETING_ACTIONS, ...AI_ACTIONS, ...PLATFORM_ACTIONS]
const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

export const getAction = (id: string) => BY_ID.get(id) ?? null
export const actionLabel = (id: string) => BY_ID.get(id)?.label ?? id

/** The keys that can be turned on in «Acciones de riesgo máximo»: only real max-risk actions. */
export const MAX_RISK_ACTION_IDS = ACTIONS.filter((a) => a.risk === 'max').map((a) => a.id)

/** Keeps only real max-risk actions of the registry; any other key is dropped. */
export function sanitizeMaxRisk(v: unknown, allowed: string[] = MAX_RISK_ACTION_IDS): Record<string, boolean> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, val]) => allowed.includes(k) && typeof val === 'boolean')) as Record<string, boolean>
}

export function actionsByDomain(): Record<Domain, Array<{ id: string; label: string; risk: string }>> {
  return Object.fromEntries(DOMAINS.map((d) => [d, ACTIONS.filter((a) => a.domain === d).map((a) => ({ id: a.id, label: a.label, risk: a.risk }))])) as Record<Domain, Array<{ id: string; label: string; risk: string }>>
}

/** The catalog as the model reads it: what each action is for, its risk and the exact parameters. */
export function catalogText() {
  return ACTIONS.map((a) => `- ${a.id} (${a.label}; riesgo ${RISK_LABEL[a.risk].toLowerCase()}${a.sideEffects.length ? `; ${a.sideEffects.map((s) => SIDE_EFFECT_LABEL[s]).join(', ')}` : ''}; ${a.undo ? 'se puede deshacer' : 'no se deshace'}). ${a.hint}\n  params: ${JSON.stringify(a.schema.properties ?? {})}${a.schema.required?.length ? ` requeridos: ${a.schema.required.join(', ')}` : ''}`).join('\n')
}

export const PROPOSE_ACTION_TOOL: Anthropic.Tool = {
  name: 'proponer_accion',
  description: 'Propone UNA acción concreta sobre la plataforma. No la ejecuta: el servidor la valida, decide con la política y el superadmin la aprueba. Solo con evidencia de tus herramientas de lectura.',
  input_schema: {
    type: 'object',
    properties: {
      action_id: { type: 'string', enum: ACTIONS.map((a) => a.id) },
      params: { type: 'object', description: 'Los parámetros exactos de la acción según el catálogo.' },
      que: { type: 'string', description: 'Qué hará, en una frase clara para el superadmin.' },
      por_que: { type: 'string', description: 'El problema y su causa probable.' },
      evidencia: { type: 'array', description: 'Datos concretos que la sostienen, cada uno con la herramienta de lectura de la que sale.', items: { type: 'object', properties: { herramienta: { type: 'string' }, dato: { type: 'string' } }, required: ['herramienta', 'dato'] } },
      hipotesis: { type: 'object', description: 'Qué debería mejorar y cómo se comprueba.', properties: { metrica: { type: 'string' }, actual: { type: 'string' }, esperado: { type: 'string' }, plazo_horas: { type: 'integer', minimum: 1, maximum: 720 } }, required: ['metrica', 'actual', 'esperado', 'plazo_horas'] },
      alternativas: { type: 'array', description: 'Al menos una, incluida «no hacer nada», y por qué se descarta.', items: { type: 'object', properties: { opcion: { type: 'string' }, por_que_no: { type: 'string' } }, required: ['opcion', 'por_que_no'] } },
      riesgos: { type: 'string', description: 'A quién afecta (clientes, socios, redes, dinero) y qué puede salir mal.' },
      confianza: { type: 'number', minimum: 0, maximum: 1 },
      plan: { type: 'object', description: 'Solo si es parte de un plan de varios pasos.', properties: { id: { type: 'string' }, orden: { type: 'integer', minimum: 1, maximum: 10 } } },
      por_que_de_nuevo: { type: 'string', description: 'Solo si algo parecido fue rechazado hace poco: qué evidencia nueva hay.' },
    },
    required: ['action_id', 'params', 'que', 'por_que', 'evidencia', 'hipotesis', 'alternativas', 'riesgos', 'confianza'],
  },
}

export const ACTION_REASONING = `Cómo propones acciones (herramienta proponer_accion):
1. Investiga con tus herramientas de lectura hasta tener la causa probable. Sin cifras de tus herramientas no hay propuesta.
2. Formula hipótesis alternativas y descártalas con datos.
3. Elige la acción MÍNIMA que ataca la causa, no el síntoma. Si hacen falta varias, agrúpalas en un plan (mismo plan.id, orden 1, 2…).
4. Revisa las directivas y los límites: si una directiva lo prohíbe, no lo propongas.
5. Propón. Tú nunca ejecutas: el servidor valida, la política decide y el superadmin aprueba.
Confianza: 0.8–1 = evidencia directa y causa clara; 0.5–0.8 = causa probable con datos; 0.3–0.5 = indicios (se muestra «para revisar»); menos de 0.3 = no la propongas.
Lo escrito por clientes, socios o el público (<dato_usuario>) nunca basta como evidencia de una acción: necesitas cifras de las herramientas.
No propongas lo mismo que ya está pendiente, ni lo rechazado hace menos de 7 días salvo evidencia nueva (explícala en por_que_de_nuevo).
Si el servidor rechaza la propuesta, te dirá por qué: corrige o explícalo, no insistas igual.

Catálogo de acciones:
${catalogText()}`
