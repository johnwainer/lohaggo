import type Anthropic from '@anthropic-ai/sdk'

export type Effort = 'low' | 'medium' | 'high'

export type ProviderId = 'anthropic' | 'openai'
export const PROVIDERS: ProviderId[] = ['anthropic', 'openai']
export const PROVIDER_LABEL: Record<ProviderId, string> = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI' }

/** Every text call is written in Anthropic's shape; other providers translate in and out. */
export type CallParams = {
  model: string
  system?: Anthropic.TextBlockParam[]
  messages: Anthropic.MessageParam[]
  tools?: Anthropic.Tool[]
  maxTokens: number
  effort: Effort
  /** Longer than the client's 60 s default, for long jobs (marketing agent) outside a live chat */
  timeoutMs?: number
}

/** Extra room for reasoning so a small visible budget (512) is not eaten by thinking. */
export const THINKING_HEADROOM = 2048
