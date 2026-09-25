import type { AgentConfig, AgentSettings } from '@/lib/marketing/agent-input'
import type { GuardrailIssue, LearningStats, Recommendation, Strategy } from '@/lib/marketing/agent-core'
import type { MkChannel } from '@/components/admin/marketing/shared'

export type { AgentConfig, AgentSettings, Strategy, Recommendation, LearningStats, GuardrailIssue }

export type AgentSummary = {
  id: string
  workspaceId: string
  campaign: { id: string; name: string; color: string; objective: string; startsAt: string | null; endsAt: string | null; description?: string | null }
  status: 'draft' | 'active' | 'paused' | 'finished'
  mode: 'copilot' | 'supervised' | 'autopilot'
  effectiveMode: 'copilot' | 'supervised' | 'autopilot'
  degradedReason: string | null
  trialPostsRemaining: number
  strategyReady: boolean
  strategyApprovedAt: string | null
  lastRunAt: string | null
  nextPlanAt: string | null
  spentUsd: number
  monthlyBudgetUsd: number
  kpi: { key: string; label: string; value: number | null; goal: number | null }
  counts: { ideasProposed: number; toApprove: number; upcoming: number; published: number }
  channels: MkChannel[]
}

export type Idea = {
  id: string
  pillar: string
  service: string | null
  angle: string
  hypothesis: string | null
  channels: MkChannel[]
  formats: Partial<Record<MkChannel, string>> | null
  targetDate: string
  rationale: string | null
  status: 'proposed' | 'accepted' | 'rejected' | 'drafted' | 'discarded'
  rejectedReason: string | null
  postId: string | null
  explore: boolean
  score: number
}

export type AgentMeta = {
  confidence?: number
  risks?: string[]
  hypothesis?: string | null
  rationale?: string | null
  service?: string | null
  imageError?: string | null
  guardrails?: GuardrailIssue[]
  validation?: string[]
  slots?: Array<{ channel: MkChannel; at: string; reason: string; kind: string }>
  scheduleProblems?: string[]
  hold?: boolean
}

export type AgentPost = {
  id: string
  title: string
  status: string
  pillar: string | null
  scheduledAt: string | null
  publishedAt: string | null
  optOutDeadline: string | null
  agentMeta: AgentMeta | null
  rejectedReason: string | null
  ideaId: string | null
  updatedAt: string
  variants: Array<{ channel: MkChannel; body: string; format: string | null; seoTitle: string | null }>
  media: Array<{ url: string; kind: string }>
  publications: Array<{ channel: MkChannel; status: string; scheduledAt: string; publishedAt: string | null; permalink: string | null; connection: { name: string } | null }>
}

export type Run = { id: string; type: string; status: string; summary: string | null; error: string | null; costUsd: number; tokensIn: number; tokensOut: number; model: string | null; startedAt: string; finishedAt: string | null }

export type Learning = { id: string; periodStart: string; periodEnd: string; sampleSize: number; metricsByDimension: LearningStats; insights: string; recommendations: Recommendation[]; applied: boolean; appliedAt: string | null; createdAt: string }

export type AgentDetailData = {
  agent: AgentSummary & { config: AgentConfig; settings: AgentSettings; strategy: Strategy | null; strategyProposedAt: string | null; autonomyConfirmedAt: string | null }
  ideas: Idea[]
  toApprove: AgentPost[]
  upcoming: AgentPost[]
  recent: AgentPost[]
  runs: Run[]
  learnings: Learning[]
  permissions: { edit: boolean; publish: boolean }
  message?: string | null
}

export type WizardOptions = {
  services: Array<{ id: string; name: string; category: string | null; basePrice: number }>
  cities: string[]
  accounts: Array<{ id: string; name: string; channel: 'FACEBOOK' | 'INSTAGRAM'; ok: boolean; problem: string | null }>
  campaigns: Array<{ id: string; name: string; objective: string; description: string | null; startsAt: string | null; endsAt: string | null; color: string }>
  examples: Array<{ id: string; channel: MkChannel; title: string; body: string }>
}

export const MODE_INFO = {
  copilot: { label: 'Copiloto', short: 'Cada pieza espera tu aprobación', cls: 'bg-sky-100 text-sky-800' },
  supervised: { label: 'Supervisado', short: 'Se programa sola; puedes cancelarla antes del plazo', cls: 'bg-amber-100 text-amber-800' },
  autopilot: { label: 'Piloto automático', short: 'Publica sola', cls: 'bg-violet-100 text-violet-800' },
} as const

export const AGENT_STATUS = {
  draft: { label: 'Configurando', cls: 'bg-gray-100 text-gray-700' },
  active: { label: 'Trabajando', cls: 'bg-emerald-100 text-emerald-800' },
  paused: { label: 'Pausado', cls: 'bg-orange-100 text-orange-800' },
  finished: { label: 'Terminado', cls: 'bg-gray-100 text-gray-500' },
} as const

export const RUN_TYPE: Record<string, string> = { strategy: 'Estrategia', plan: 'Planificación', draft: 'Redacción', schedule: 'Programación', learn: 'Aprendizaje', notice: 'Aviso' }
