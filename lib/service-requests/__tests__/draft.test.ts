import { describe, expect, it } from 'vitest'
import { bogotaDatePlus, clearDraft, composeNotes, DRAFT_KEY, DRAFT_TTL_MS, emptyDraft, loadDraft, saveDraft, timingPayload } from '@/lib/service-requests/draft'

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('borrador de solicitud', () => {
  it('guarda y recupera para el mismo servicio', () => {
    const s = memory()
    const d = { ...emptyDraft('plomeria'), step: 3, newAddress: { street: 'Calle 10 # 43-21', neighborhood: 'Laureles', instructions: '' }, notes: 'Fuga', when: 'flexible' as const }
    saveDraft(s, d, 1000)
    const back = loadDraft(s, 'plomeria', 2000)
    expect(back).toMatchObject({ step: 3, notes: 'Fuga', when: 'flexible', newAddress: { street: 'Calle 10 # 43-21', neighborhood: 'Laureles' } })
  })
  it('no mezcla servicios ni devuelve borradores viejos o rotos', () => {
    const s = memory()
    saveDraft(s, emptyDraft('plomeria'), 1000)
    expect(loadDraft(s, 'aseo', 2000)).toBeNull()
    expect(loadDraft(s, 'plomeria', 1000 + DRAFT_TTL_MS + 1)).toBeNull()
    s.setItem(DRAFT_KEY, '{nope')
    expect(loadDraft(s, 'plomeria')).toBeNull()
  })
  it('sanea valores inesperados', () => {
    const s = memory()
    s.setItem(DRAFT_KEY, JSON.stringify({ v: 1, slug: 'x', savedAt: Date.now(), step: 99, when: 'hack', preferredDate: 'mañana', addressMode: 'x' }))
    expect(loadDraft(s, 'x')).toMatchObject({ step: 3, when: 'asap', preferredDate: '', addressMode: 'new' })
  })
  it('se borra al enviar', () => {
    const s = memory()
    saveDraft(s, emptyDraft('x'))
    clearDraft(s)
    expect(loadDraft(s, 'x')).toBeNull()
  })
  it('sin storage no lanza', () => {
    expect(() => saveDraft(null, emptyDraft('x'))).not.toThrow()
    expect(loadDraft(undefined, 'x')).toBeNull()
  })
})

describe('cuándo', () => {
  const now = new Date('2026-09-28T03:00:00.000Z') // 27 sep 22:00 en Bogotá
  it('lo antes posible es urgente sin fecha', () => {
    expect(timingPayload('asap', '2026-10-01', '10:00', now)).toEqual({ isUrgent: true, preferredDate: null, preferredTime: null, note: null })
  })
  it('flexible es hoy+2 en Bogotá, sin hora y con nota', () => {
    expect(timingPayload('flexible', '', '', now)).toEqual({ isUrgent: false, preferredDate: '2026-09-29', preferredTime: null, note: 'Horario flexible esta semana' })
    expect(bogotaDatePlus(0, now)).toBe('2026-09-27')
  })
  it('programado pasa fecha y hora', () => {
    expect(timingPayload('scheduled', '2026-10-01', '10:00', now)).toEqual({ isUrgent: false, preferredDate: '2026-10-01', preferredTime: '10:00', note: null })
  })
  it('notas combinadas', () => {
    expect(composeNotes({ notes: ' Fuga en el baño ', timingNote: 'Horario flexible esta semana', instructions: 'Portería 2' }))
      .toBe('Fuga en el baño\nHorario flexible esta semana\nIndicaciones para llegar: Portería 2')
    expect(composeNotes({})).toBe('')
  })
})
