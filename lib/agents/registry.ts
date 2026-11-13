/**
 * The platform's agents as one map: who they are, what they read, what they produce and what they can ask
 * each other. The single place Haggo (and the admin panel) learns the team from. Pure: live status is in live.ts.
 */

export const AGENT_KEYS = ['haggo', 'inbox', 'copilot', 'marketing', 'editorial', 'ads', 'seo'] as const
export type AgentKey = (typeof AGENT_KEYS)[number]

export const NOTE_TOPICS = ['content_request', 'idea_request', 'new_guide', 'seo_guidance', 'learning', 'alert', 'question', 'answer'] as const
export type NoteTopic = (typeof NOTE_TOPICS)[number]
export const NOTE_KINDS = ['request', 'insight', 'alert', 'answer'] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

export type AgentInfo = {
  key: AgentKey
  name: string
  /** What it is for, in one or two sentences */
  purpose: string
  /** Data it reads to do its job */
  reads: string[]
  /** What it produces */
  produces: string[]
  /** Topics it can receive and what it does with them */
  accepts: Partial<Record<NoteTopic, string>>
  /** Where a person manages it */
  adminUrl: string
  /** Acts alone, proposes to a person, or only observes */
  autonomy: string
}

export const AGENTS: AgentInfo[] = [
  {
    key: 'haggo', name: 'Haggo (agente maestro)',
    purpose: 'Supervisa toda la plataforma, detecta problemas, propone acciones y, donde el superadmin lo permite, las ejecuta. Conoce a los demás agentes y les puede dejar notas.',
    reads: ['La foto de la plataforma cada 5 minutos', 'Herramientas de lectura de todas las áreas', 'Las notas dirigidas a él'],
    produces: ['Hallazgos', 'Acciones propuestas o ejecutadas', 'Informes', 'Notas a otros agentes'],
    accepts: { alert: 'Entra como hallazgo si es grave y queda a la vista en la herramienta agentes', question: 'Lo investiga con sus herramientas y responde con una nota', learning: 'Lo guarda como contexto para sus informes', answer: 'Respuesta a una nota suya' },
    adminUrl: '/admin/haggo', autonomy: 'Propone; actúa solo en las áreas que el superadmin pone en autónomo y con riesgo permitido',
  },
  {
    key: 'inbox', name: 'Agentes de la bandeja (IA de atención)',
    purpose: 'Atienden por WhatsApp, Messenger, Instagram y correo: responden dudas, crean solicitudes, agendan y cierran conversaciones; pasan a una persona cuando hace falta.',
    reads: ['Base de conocimiento', 'Datos del cliente y sus solicitudes', 'Notas de otros agentes (guías nuevas, promociones, avisos)'],
    produces: ['Respuestas a clientes', 'Solicitudes y acciones en la plataforma', 'Preguntas que no supieron responder (huecos de conocimiento)'],
    accepts: { new_guide: 'Pueden recomendar la guía al cliente cuando viene al caso', alert: 'Tienen en cuenta el aviso (por ejemplo un servicio sin socios hoy)', answer: 'Contexto para conversaciones abiertas' },
    adminUrl: '/admin/ai-agents', autonomy: 'Piloto (responden solos) o copiloto (sugieren a una persona), por canal',
  },
  {
    key: 'copilot', name: 'Copiloto de la bandeja',
    purpose: 'Sugiere respuestas a la persona que atiende una conversación.',
    reads: ['La conversación', 'Base de conocimiento'], produces: ['Respuestas sugeridas'], accepts: {},
    adminUrl: '/admin/inbox', autonomy: 'Solo sugiere; una persona envía',
  },
  {
    key: 'marketing', name: 'Agentes de marketing',
    purpose: 'Uno por campaña: estrategia, plan de ideas, redacción de piezas (Instagram, Facebook y blog), programación y aprendizaje semanal.',
    reads: ['Catálogo y ciudades', 'Resultados de publicaciones', 'Notas del agente de SEO (palabras clave, briefs, guías cubiertas)', 'Notas de otros agentes'],
    produces: ['Ideas', 'Publicaciones', 'Retrospectiva semanal', 'Notas de aprendizaje para SEO'],
    accepts: { idea_request: 'Lo considera al planificar (no obliga)', seo_guidance: 'Lo aplica en ideas y redacción', alert: 'Ajusta el plan (por ejemplo un servicio sin socios)', answer: 'Respuesta a una nota suya' },
    adminUrl: '/admin/marketing', autonomy: 'Copiloto, supervisado o piloto automático, por campaña y canal',
  },
  {
    key: 'editorial', name: 'Revisión editorial (corrector y editor)',
    purpose: 'Revisa cada pieza antes de publicarse: ortografía, claridad, veracidad, cumplimiento y SEO del blog.',
    reads: ['La pieza y las reglas de la marca'], produces: ['Veredicto y cambios pedidos'], accepts: {},
    adminUrl: '/admin/marketing', autonomy: 'Detiene o aprueba; el redactor corrige',
  },
  {
    key: 'ads', name: 'Agente de pauta (Meta Ads)',
    purpose: 'Prepara paquetes de anuncios para Meta; se suben a mano. Mide el costo por solicitud y por reserva.',
    reads: ['Resultados por pieza y pauta', 'Gasto cargado'], produces: ['Paquetes de anuncios'], accepts: { alert: 'Ajusta o pausa propuestas', answer: 'Respuesta a una nota suya' },
    adminUrl: '/admin/marketing', autonomy: 'Propone; una persona sube los anuncios',
  },
  {
    key: 'seo', name: 'Agente de SEO',
    purpose: 'Busca cómo traer más clientes desde Google: revisa el sitio y Search Console, encuentra oportunidades, escribe briefs de artículos y un informe semanal.',
    reads: ['Catálogo, socios y solicitudes por ciudad', 'Blog y su indexación en Google', 'Búsquedas sin resultado y preguntas que el bot no supo responder', 'Notas de otros agentes'],
    produces: ['Oportunidades y briefs (van como ideas al agente de marketing)', 'Informe semanal', 'Notas: guías nuevas, indicaciones para marketing y alertas'],
    accepts: { content_request: 'Lo vuelve una oportunidad de contenido con su brief', learning: 'Lo usa para priorizar temas', question: 'Responde con una nota si puede', answer: 'Respuesta a una nota suya' },
    adminUrl: '/admin/seo', autonomy: 'Nunca publica; propone y envía briefs al agente de marketing',
  },
]

const BY_KEY = new Map(AGENTS.map((a) => [a.key, a]))
export const getAgent = (key: string) => BY_KEY.get(key as AgentKey) ?? null
export const isAgentKey = (v: unknown): v is AgentKey => typeof v === 'string' && BY_KEY.has(v as AgentKey)
export const isTopic = (v: unknown): v is NoteTopic => typeof v === 'string' && (NOTE_TOPICS as readonly string[]).includes(v)
export const isKind = (v: unknown): v is NoteKind => typeof v === 'string' && (NOTE_KINDS as readonly string[]).includes(v)

/** The team as text for a prompt (static: cacheable). */
export function registryText(): string {
  return AGENTS.map((a) => `- ${a.name} [${a.key}] (${a.adminUrl}): ${a.purpose} Autonomía: ${a.autonomy}. Lee: ${a.reads.join('; ')}. Produce: ${a.produces.join('; ')}.${Object.keys(a.accepts).length ? ` Recibe notas de tipo: ${Object.entries(a.accepts).map(([t, w]) => `${t} (${w})`).join('; ')}.` : ''}`).join('\n')
}
