export const DEFAULT_MODEL = 'claude-opus-5'
export const FALLBACK_MODEL = 'claude-haiku-4-5'
export const DEFAULT_EMBEDDING_MODEL = 'voyage-3'

export type ModelOption = { id: string; displayName: string; source: 'api' | 'static' }

/** Used only when GET /v1/models is unreachable (no key, network error). */
export const STATIC_MODELS: ModelOption[] = [
  { id: 'claude-opus-5', displayName: 'Claude Opus 5', source: 'static' },
  { id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5', source: 'static' },
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', source: 'static' },
]

export const VOYAGE_MODELS: Array<{ id: string; dim: number; label: string }> = [
  { id: 'voyage-3', dim: 1024, label: 'voyage-3 (recomendado)' },
  { id: 'voyage-3-large', dim: 1024, label: 'voyage-3-large (más preciso)' },
  { id: 'voyage-3-lite', dim: 512, label: 'voyage-3-lite (más barato)' },
  { id: 'voyage-multilingual-2', dim: 1024, label: 'voyage-multilingual-2' },
  { id: 'voyage-code-3', dim: 1024, label: 'voyage-code-3' },
]

export function voyageDim(model: string) {
  return VOYAGE_MODELS.find((m) => m.id === model)?.dim ?? 1024
}

/**
 * Request-shape capabilities per model family. Claude 5 and 4.6+ take adaptive thinking + effort and
 * reject sampling params; Haiku 4.5 and older reject `effort` and adaptive thinking.
 */
export function modelCaps(model: string) {
  const id = model.toLowerCase()
  const legacy = /haiku|claude-3|-4-5\b|-4-5-|-4-1|-4-0|claude-(opus|sonnet)-4$/.test(id)
  return { adaptiveThinking: !legacy, effort: !legacy }
}
