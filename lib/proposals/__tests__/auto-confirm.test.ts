import { describe, expect, it } from 'vitest'
import { shouldAutoConfirm } from '@/lib/proposals/auto-confirm'

describe('shouldAutoConfirm', () => {
  const day = new Date('2026-12-01T00:00:00.000Z')

  it('día y hora propuestos por el socio y aceptados tal cual → confirmada', () => {
    expect(shouldAutoConfirm({ proposedDate: day, proposedTime: '15:00' })).toBe(true)
    expect(shouldAutoConfirm({ proposedDate: '2026-12-01', proposedTime: '08:30' }, {})).toBe(true)
  })

  it('sin hora o sin día → el socio todavía debe confirmar', () => {
    expect(shouldAutoConfirm({ proposedDate: day, proposedTime: null })).toBe(false)
    expect(shouldAutoConfirm({ proposedDate: null, proposedTime: '15:00' })).toBe(false)
    expect(shouldAutoConfirm({})).toBe(false)
  })

  it('hora mal formada → no confirma', () => {
    expect(shouldAutoConfirm({ proposedDate: day, proposedTime: '25:00' })).toBe(false)
  })

  it('el cliente cambió la fecha → el socio no la acordó: pendiente', () => {
    expect(shouldAutoConfirm({ proposedDate: day, proposedTime: '15:00' }, { scheduledDate: new Date('2026-12-05T00:00:00.000Z') })).toBe(false)
  })
})
