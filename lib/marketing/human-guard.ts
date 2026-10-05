/**
 * The agent's guardrails (prices outside the catalog, promotions that do not exist, foreign links,
 * banned words) read on a person's post too, as warnings before publishing: a person may know
 * something the configuration does not, so nothing is blocked.
 */
import { prisma } from '@/lib/prisma'
import { checkGuardrails } from '@/lib/marketing/agent-core'
import { catalogFor } from '@/lib/marketing/agent-data'
import { defaultAgentConfig, normalizeDomain, readAgentConfig } from '@/lib/marketing/agent-input'
import type { MarketingChannel } from '@/lib/marketing/channel-rules'
import { readPublishOptions } from '@/lib/marketing/publish-options'
import { SITE_URL } from '@/lib/marketing/seo'

export async function humanGuardrails(post: { workspaceId: string; campaignId: string | null; agentId: string | null; variants: Array<{ channel: string; body: string; linkUrl: string | null; publishOptions: unknown }> }, accounts: Array<{ channel: string; name: string }>) {
  // An agent post already went through them when it was written and scheduled
  if (post.agentId) return []
  // The campaign's agent configuration when there is one (its promotions, prices, banned words); otherwise the defaults
  const agent = post.campaignId ? await prisma.marketingAgent.findFirst({ where: { campaignId: post.campaignId, status: { not: 'archived' } }, select: { config: true } }) : null
  const config = agent ? readAgentConfig(agent.config) : defaultAgentConfig()
  const catalog = await catalogFor(config).catch(() => ({ prices: [] as number[] }))
  const texts = post.variants.map((v) => {
    const o = readPublishOptions(v.publishOptions)
    return { channel: v.channel as MarketingChannel, text: [v.body, o.storyText, o.storyCta].filter(Boolean).join('\n\n'), linkUrl: v.linkUrl }
  })
  const result = checkGuardrails(texts, {
    now: new Date(),
    promos: config.offer.promos,
    allowedTexts: [...config.offer.facts, config.offer.priceNotes, config.offer.valueProp, ...config.offer.differentiators],
    prices: catalog.prices,
    bannedWords: config.voice.bannedWords,
    bannedTopics: config.voice.bannedTopics,
    ownDomains: [normalizeDomain(SITE_URL) || 'lohaggo.com'],
    allowedDomains: config.offer.allowedDomains,
    allowedHandles: accounts.filter((a) => a.channel === 'INSTAGRAM').map((a) => a.name.replace(/^@/, '').trim()).filter((n) => /^[A-Za-z0-9._]+$/.test(n)),
    confidence: null,
    confidenceThreshold: 0,
  })
  // Confidence is the agent's own measure: not a person's concern
  return result.issues.filter((i) => i.code !== 'low_confidence').map((i) => ({ channel: i.channel ?? null, message: i.message, severity: i.severity }))
}
