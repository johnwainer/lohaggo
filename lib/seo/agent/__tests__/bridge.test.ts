import { describe, expect, it } from 'vitest'
import { WEB_SEO_RULES, briefText } from '@/lib/seo/agent/marketing-bridge'
import { draftTask, planTask } from '@/lib/marketing/agent-prompt'
import type { SeoBrief } from '@/lib/seo/agent/types'

const brief: SeoBrief = {
  keyword: 'plomero en Medellín', secondary: ['plomero cerca'], intent: 'local', title: 'Cómo elegir un plomero', seoTitle: 'Elegir plomero en Medellín', seoDescription: 'Guía para elegir un plomero verificado.',
  outline: [{ h2: 'Señales de alerta', points: ['sin factura', 'sin garantía'] }], faqs: [{ q: '¿Cuánto cuesta?', a: 'Desde $50.000.' }],
  internalLinks: [{ url: '/servicios/plomeria', anchor: 'plomería' }], facts: ['5 socios verificados'], cta: 'Pide tu plomero', schema: 'FAQPage', format: 'guía', notes: 'Evita prometer tiempos.',
}

describe('briefText', () => {
  it('gives the writer keyword, outline, FAQs, absolute links and only the allowed facts', () => {
    const t = briefText(brief)
    expect(t).toContain('plomero en Medellín')
    expect(t).toContain('Señales de alerta')
    expect(t).toContain('¿Cuánto cuesta?')
    expect(t).toContain('[plomería](https://www.lohaggo.com/servicios/plomeria)')
    expect(t).toContain('5 socios verificados')
  })
  it('forbids figures when there are no facts', () => {
    expect(briefText({ ...brief, facts: [] })).toContain('No cites cifras')
  })
})

describe('marketing prompts receive the SEO context', () => {
  const plan = { gaps: [], daily: [], order: [], exploreCount: 0, fromDay: '2026-11-14', toDay: '2026-11-20', maxIdeas: 4 }
  it('planTask adds the SEO block only when there is one', () => {
    expect(planTask(plan)).not.toContain('agente de SEO')
    expect(planTask({ ...plan, seo: 'Atacar: plomero en Laureles' })).toContain('Atacar: plomero en Laureles')
  })
  const idea = { pillar: 'Guías', service: 'Plomería', angle: 'a', hypothesis: null, channels: ['WEB' as const], formats: { WEB: 'guía' }, rationale: null }
  it('draftTask adds the brief or the short web rules', () => {
    expect(draftTask({ idea, utmNote: 'u' })).not.toContain('brief SEO')
    expect(draftTask({ idea, utmNote: 'u', seo: briefText(brief) })).toContain('Plan del agente de SEO')
    expect(draftTask({ idea, utmNote: 'u', seo: WEB_SEO_RULES })).toContain('SEO del blog')
  })
})
