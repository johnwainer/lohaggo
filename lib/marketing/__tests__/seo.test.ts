import { describe, expect, it } from 'vitest'

describe('extractFaq', () => {
  const md = `## Guía\n\nTexto.\n\n## Preguntas frecuentes\n\n### ¿Cuánto cuesta un plomero en Medellín?\n\nDesde $100.000 según el trabajo y la zona.\n\n### ¿Hay garantía?\n\nSí, LoHaggo busca otro socio si el trabajo queda incompleto.\n\n## Conclusión\n\nFin.`
  it('takes the questions and answers of the FAQ section and stops at the next section', async () => {
    const { extractFaq } = await import('@/lib/marketing/seo')
    const r = extractFaq(md)
    expect(r).toHaveLength(2)
    expect(r[0].q).toBe('¿Cuánto cuesta un plomero en Medellín?')
    expect(r[1].a).toContain('otro socio')
  })
  it('also reads bold questions and ignores articles without a FAQ', async () => {
    const { extractFaq } = await import('@/lib/marketing/seo')
    expect(extractFaq('## Preguntas frecuentes\n\n**¿Sirve para casas?** Sí, para casas y apartamentos de Medellín.\n\n**¿Cuánto tarda?** Depende del trabajo, normalmente el mismo día.')).toHaveLength(2)
    expect(extractFaq('## Guía\n\nSin preguntas.')).toEqual([])
  })
  it('builds a FAQPage with the answers as text', async () => {
    const { faqPageJsonLd } = await import('@/lib/marketing/seo')
    const j = faqPageJsonLd([{ q: '¿Hay garantía?', a: 'Sí.' }]) as { '@type': string; mainEntity: Array<{ name: string }> }
    expect(j['@type']).toBe('FAQPage')
    expect(j.mainEntity[0].name).toBe('¿Hay garantía?')
  })
})
