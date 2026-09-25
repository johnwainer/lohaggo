import { describe, expect, it } from 'vitest'
import { cronHealth, cronInterval, errorFingerprint, jobKey, shouldOpenIncident } from '@/lib/system/core'

const MIN = 60_000

describe('intervalos de los crons', () => {
  it('lee las expresiones que usa Vercel', () => {
    expect(cronInterval('* * * * *')).toBe(MIN)
    expect(cronInterval('*/15 * * * *')).toBe(15 * MIN)
    expect(cronInterval('20 * * * *')).toBe(60 * MIN)
    expect(cronInterval('0 */6 * * *')).toBe(6 * 60 * MIN)
    expect(cronInterval('0 11 * * *')).toBe(24 * 60 * MIN)
    expect(cronInterval('0 9 * * 1')).toBeNull()
  })
  it('nombre de la tarea desde su ruta', () => {
    expect(jobKey('/api/cron/marketing-agent')).toBe('marketing-agent')
    expect(jobKey('/api/pwa/cron/adoption-alerts')).toBe('pwa-adoption-alerts')
    expect(jobKey('/api/admin/messaging/run-scheduled')).toBe('admin-messaging-run-scheduled')
  })
})

describe('salud de una tarea', () => {
  const now = new Date('2026-09-25T12:00:00Z')
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * MIN)
  it('sin ejecuciones, al día, atrasada, fallando y colgada', () => {
    expect(cronHealth([], MIN, now)).toBe('never')
    expect(cronHealth([{ status: 'ok', startedAt: at(1) }], MIN, now)).toBe('ok')
    expect(cronHealth([{ status: 'ok', startedAt: at(10) }], MIN, now)).toBe('late')
    expect(cronHealth([{ status: 'ok', startedAt: at(70) }], 60 * MIN, now)).toBe('ok')
    expect(cronHealth([{ status: 'error', startedAt: at(1) }, { status: 'ok', startedAt: at(2) }], MIN, now)).toBe('failing')
    expect(cronHealth([{ status: 'running', startedAt: at(20) }], MIN, now)).toBe('stuck')
    expect(cronHealth([{ status: 'running', startedAt: at(0) }, { status: 'ok', startedAt: at(1) }], MIN, now)).toBe('ok')
  })
  it('incidente con dos fallos seguidos', () => {
    expect(shouldOpenIncident([{ status: 'error' }, { status: 'error' }])).toBe(true)
    expect(shouldOpenIncident([{ status: 'running' }, { status: 'error' }, { status: 'error' }])).toBe(true)
    expect(shouldOpenIncident([{ status: 'error' }, { status: 'ok' }])).toBe(false)
  })
})

describe('agrupación de errores', () => {
  it('el mismo error con ids o números distintos es un solo grupo', () => {
    const a = errorFingerprint('server', 'bookings', 'Booking cmug8q8pk0003xmfh314rpnvh not found (attempt 3)')
    const b = errorFingerprint('server', 'bookings', 'Booking ckabc123def456ghi789jk not found (attempt 7)')
    expect(a).toBe(b)
    expect(errorFingerprint('server', 'payments', 'Booking x not found')).not.toBe(errorFingerprint('server', 'bookings', 'Booking x not found'))
  })
})
