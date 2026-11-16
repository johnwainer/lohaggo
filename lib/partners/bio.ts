/** Redacta la biografía de un socio con IA. Nunca lanza: si la IA no responde, devuelve el texto armado con sus datos. */
import { callAI } from '@/lib/ai/anthropic'
import { getAiSettings } from '@/lib/ai/settings'
import { toolInput } from '@/lib/marketing/agent-core'
import { createLogger } from '@/lib/logger'
import { BIO_SYSTEM, BIO_TOOL, bioPrompt, sanitizeBio, templateBio, type BioDraft, type BioFacts } from '@/lib/partners/bio-core'

const logger = createLogger('partner-bio')

export async function draftPartnerBio(facts: BioFacts): Promise<BioDraft> {
  try {
    const settings = await getAiSettings()
    const result = await callAI(
      { model: settings.defaultModel, system: [{ type: 'text', text: BIO_SYSTEM }], messages: [{ role: 'user', content: bioPrompt(facts) }], tools: [BIO_TOOL], maxTokens: 700, effort: 'low', timeoutMs: 40_000 },
      { kind: 'partner_bio_assist' },
    )
    const ok = sanitizeBio(toolInput(result.message.content, BIO_TOOL.name), facts)
    if (ok) return { ...ok, source: 'ai' }
    logger.warn('Bio draft rejected by the sanitizer')
  } catch (err) {
    logger.warn('Bio draft failed', { message: err instanceof Error ? err.message.slice(0, 160) : 'error' })
  }
  return { ...templateBio(facts), source: 'template' }
}
