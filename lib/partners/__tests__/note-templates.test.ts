import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTE_TEMPLATES, MAX_TEMPLATES, addNoteTemplate, applyNoteTemplate, loadNoteTemplates, removeNoteTemplate, suggestedProposalPrice } from '@/lib/partners/note-templates'

function memory() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
}

describe('plantillas de nota', () => {
  it('sin nada guardado ofrece las de ejemplo', () => {
    expect(loadNoteTemplates(memory())).toEqual([...DEFAULT_NOTE_TEMPLATES])
    expect(loadNoteTemplates(null)).toEqual([...DEFAULT_NOTE_TEMPLATES])
  })

  it('agrega la nueva primero, sin duplicados (ignora mayúsculas) y con tope', () => {
    const s = memory()
    addNoteTemplate(s, 'Incluye transporte')
    expect(addNoteTemplate(s, '  incluye   TRANSPORTE ')[0]).toBe('incluye TRANSPORTE')
    expect(loadNoteTemplates(s).filter((t) => /transporte/i.test(t))).toHaveLength(1)
    for (let i = 0; i < 12; i++) addNoteTemplate(s, `Nota ${i}`)
    expect(loadNoteTemplates(s)).toHaveLength(MAX_TEMPLATES)
  })

  it('una plantilla vacía no se guarda y se puede quitar', () => {
    const s = memory()
    const before = loadNoteTemplates(s)
    expect(addNoteTemplate(s, '   ')).toEqual(before)
    addNoteTemplate(s, 'Mi nota')
    expect(removeNoteTemplate(s, 'Mi nota')).not.toContain('Mi nota')
  })

  it('un JSON dañado vuelve a las de ejemplo', () => {
    const s = memory()
    s.setItem('lohaggo:proposal-note-templates', '{no es json')
    expect(loadNoteTemplates(s)).toEqual([...DEFAULT_NOTE_TEMPLATES])
  })
})

describe('applyNoteTemplate', () => {
  it('la agrega como una frase más y nunca dos veces', () => {
    expect(applyNoteTemplate('', 'Incluye materiales')).toBe('Incluye materiales.')
    expect(applyNoteTemplate('Voy con ayudante.', 'Visita sin costo')).toBe('Voy con ayudante. Visita sin costo.')
    const once = applyNoteTemplate('', 'Incluye materiales')
    expect(applyNoteTemplate(once, 'incluye materiales')).toBe(once)
  })
})

describe('suggestedProposalPrice', () => {
  it('usa el precio del catálogo si cumple el mínimo; si no, el mínimo; sin catálogo nada', () => {
    expect(suggestedProposalPrice(80000, 50000)).toBe(80000)
    expect(suggestedProposalPrice(30000, 50000)).toBe(50000)
    expect(suggestedProposalPrice(null, 50000)).toBeNull()
    expect(suggestedProposalPrice(0, 50000)).toBeNull()
  })
})
