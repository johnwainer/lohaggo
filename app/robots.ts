import { MetadataRoute } from 'next'

const DISALLOW = [
  '/api/',
  '/admin/',
  '/dashboard/',
  '/profile/',
  '/partner/',
  // Enlaces de un solo uso y flujos de cuenta
  '/cita/',
  '/w/',
  '/auth/',
  '/olvide-mi-contrasena',
  '/restablecer-contrasena',
  '/login',
  '/register',
  '/notifications',
  '/my-ratings',
  '/servicios?',
]

/**
 * Crawlers of the AI assistants and AI search engines, named on purpose: being read and cited by ChatGPT, Claude,
 * Perplexity, Gemini and Copilot is part of the organic strategy, so none of them is ever left to a default.
 * They see exactly what Google sees (same private routes closed).
 */
export const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Bingbot', 'meta-externalagent', 'DuckAssistBot', 'MistralAI-User', 'cohere-ai',
] as const

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: 'Googlebot', allow: '/', disallow: DISALLOW, crawlDelay: 0 },
      { userAgent: [...AI_CRAWLERS], allow: '/', disallow: DISALLOW },
    ],
    sitemap: 'https://www.lohaggo.com/sitemap.xml',
  }
}
