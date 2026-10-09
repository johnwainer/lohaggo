import { describe, expect, it } from 'vitest'
import { arbiterPrecheck, isLinkParamAsk, parseArbiter } from '@/lib/marketing/arbiter-core'
import { instructionsForAgent } from '@/lib/marketing/editorial-core'

const base = { editorStatus: 'changes' as const, score: 7, minScore: 8, blocks: [], requestedByPerson: false }

describe('árbitro entre redactor y editor', () => {
  it('deja a una persona lo que una persona pidió o lo que tiene un bloqueo real', () => {
    expect(arbiterPrecheck({ ...base, requestedByPerson: true })?.decision).toBe('human')
    expect(arbiterPrecheck({ ...base, blocks: ['Precio que no está en el catálogo'] })?.decision).toBe('human')
  })
  it('descarta un enfoque rechazado o muy por debajo del mínimo', () => {
    expect(arbiterPrecheck({ ...base, editorStatus: 'rejected' })?.decision).toBe('discard')
    expect(arbiterPrecheck({ ...base, score: 5.5 })?.decision).toBe('discard')
  })
  it('deja a Haggo el desacuerdo cercano al mínimo y la revisión fallida', () => {
    expect(arbiterPrecheck({ ...base, score: 6.8 })).toBeNull()
    expect(arbiterPrecheck({ ...base, editorStatus: 'failed', score: null })).toBeNull()
  })
  it('lee la decisión del modelo y rechaza respuestas raras', () => {
    expect(parseArbiter({ decision: 'publicar', motivo: 'Clara y veraz' })).toEqual({ decision: 'publish', reason: 'Clara y veraz' })
    expect(parseArbiter({ decision: 'quizás' })).toBeNull()
  })
  it('los pedidos sobre parámetros de enlaces no le llegan al redactor', () => {
    expect(isLinkParamAsk('Conserva la URL con UTM')).toBe(true)
    expect(isLinkParamAsk('Acorta el titular')).toBe(false)
    const asks = instructionsForAgent([{ channel: null, field: null, change: 'Conserva los parámetros de seguimiento del enlace', reason: null }, { channel: null, field: null, change: 'Acorta el titular', reason: null }] as never)
    expect(asks).toHaveLength(1)
    expect(asks[0]).toContain('Acorta el titular')
  })
})
