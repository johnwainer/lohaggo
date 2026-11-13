import type { AgentInfo, AgentKey } from '@/lib/agents/registry'

export type AgentLiveView = { key: AgentKey; status: 'ok' | 'attention' | 'off' | 'unknown'; headline: string; details: string[] }
export type AgentCardData = AgentInfo & { live: AgentLiveView }
export type NoteRow = {
  id: string; fromAgent: string; toAgent: string | null; topic: string; kind: string; title: string; body: string | null
  priority: string; createdAt: string; status?: string; readBy?: string[]; resolvedBy?: string | null
}
export type AgentsData = {
  agents: AgentCardData[]
  bus: {
    tablesReady: boolean
    open: { toAgent: string | null; priority: string; _count: { _all: number }; _min: { createdAt: string | null } }[]
    recent: NoteRow[]
    flows7d: { from: string; to: string | null; count: number }[]
  }
  canEdit: boolean
}

export const TOPIC_LABEL: Record<string, string> = {
  content_request: 'Pide contenido', idea_request: 'Pide una idea', new_guide: 'Guía nueva', seo_guidance: 'Indicación de SEO',
  learning: 'Aprendizaje', alert: 'Alerta', question: 'Pregunta', answer: 'Respuesta',
}
export const STATUS_LIVE: Record<string, { label: string; dot: string; cls: string }> = {
  ok: { label: 'Bien', dot: 'bg-emerald-500', cls: 'bg-emerald-100 text-emerald-800' },
  attention: { label: 'Atención', dot: 'bg-amber-500', cls: 'bg-amber-100 text-amber-800' },
  off: { label: 'Apagado', dot: 'bg-gray-400', cls: 'bg-gray-100 text-gray-600' },
  unknown: { label: 'Sin datos', dot: 'bg-gray-300', cls: 'bg-gray-50 text-gray-500' },
}
export const NOTE_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Abierta', cls: 'bg-blue-100 text-blue-800' },
  done: { label: 'Atendida', cls: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Descartada', cls: 'bg-gray-100 text-gray-600' },
}
export const PRIORITY: Record<string, { label: string; cls: string }> = {
  high: { label: 'Alta', cls: 'bg-rose-100 text-rose-700' },
  normal: { label: 'Normal', cls: 'bg-gray-100 text-gray-700' },
  low: { label: 'Baja', cls: 'bg-gray-50 text-gray-500' },
}

export const shortName = (key: string | null | undefined, agents: AgentCardData[]) => {
  if (!key) return 'Todos'
  const a = agents.find((x) => x.key === key)
  return a ? a.name.replace(/\s*\(.*\)\s*$/, '') : key
}

export function ageLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `hace ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}
