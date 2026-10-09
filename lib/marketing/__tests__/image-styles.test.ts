import { describe, expect, it } from 'vitest'
import { defaultImageStyleConfig, resolveStyle, sanitizeImageStyles, styleGuide, usableStyles } from '@/lib/marketing/image-styles'
import { finalPrompt } from '@/lib/marketing/images-core'

describe('estilos de imagen', () => {
  it('el agente elige entre los activados y cae al primero si elige uno no permitido', () => {
    const c = { ...defaultImageStyleConfig(), enabled: ['profesional', 'animada'] }
    expect(usableStyles(c).map((s) => s.id)).toEqual(['profesional', 'animada'])
    expect(resolveStyle(c, 'animada')?.id).toBe('animada')
    expect(resolveStyle(c, 'ilustracion')?.id).toBe('profesional')
  })
  it('un estilo fijo manda sobre la elección del agente', () => {
    const c = { ...defaultImageStyleConfig(), pick: 'minimalista' }
    expect(resolveStyle(c, 'cercana')?.id).toBe('minimalista')
    expect(styleGuide(c)).toContain('fijó «Minimalista»')
  })
  it('limpia la entrada: ids desconocidos fuera, estilos propios válidos y ejemplos solo https', () => {
    const c = sanitizeImageStyles({ enabled: ['profesional', 'nada', 'custom-1'], pick: 'otro', custom: [{ id: 'custom-1', label: 'Acuarela', prompt: 'acuarela suave' }, { label: '', prompt: 'x' }], examples: { profesional: { url: 'https://res.cloudinary.com/x.jpg', source: 'ai' }, cercana: { url: 'http://x' } } })
    expect(c.enabled).toEqual(['profesional', 'custom-1'])
    expect(c.pick).toBe('auto')
    expect(c.custom).toHaveLength(1)
    expect(Object.keys(c.examples)).toEqual(['profesional'])
  })
  it('el estilo llega al pedido de la imagen', () => {
    const c = defaultImageStyleConfig()
    const s = resolveStyle(c, 'ilustracion')!
    expect(finalPrompt('Plomero arreglando un lavamanos', { style: s.prompt, orientation: 'square', withReference: false })).toContain('ilustración vectorial plana')
  })
})
