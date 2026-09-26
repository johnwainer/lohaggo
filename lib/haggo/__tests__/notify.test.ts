import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ findFirst: vi.fn(), create: vi.fn(), users: vi.fn(), send: vi.fn(async () => ({ ok: true })), cfg: { notify: { approvals: true, critical: true, budget: true, auto_undo: true, daily_report: false } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { haggoMemory: { findFirst: m.findFirst, create: m.create, deleteMany: vi.fn(async () => ({})) }, user: { findMany: m.users } } }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/messaging/providers', () => ({ sendMessageViaProvider: m.send }))
vi.mock('@/lib/messaging/provider-config', () => ({ getMessagingProviderRuntimeConfig: async () => ({ sendgrid: { active: true } }) }))
vi.mock('@/lib/haggo/store', () => ({ getHaggoConfig: async () => m.cfg }))

import { approvalsKey, notify, renderNotice } from '@/lib/haggo/notify'
import { normalizeConfig } from '@/lib/haggo/config'

describe('avisos por correo', () => {
  beforeEach(() => { vi.clearAllMocks(); m.users.mockResolvedValue([{ email: 'super@lohaggo.com' }]); m.findFirst.mockResolvedValue(null) })

  it('base: todos encendidos salvo el informe diario completo; configurables', () => {
    expect(normalizeConfig({}).notify).toEqual({ approvals: true, critical: true, budget: true, auto_undo: true, daily_report: false })
    expect(normalizeConfig({ notify: { daily_report: true, inventado: true } }).notify.daily_report).toBe(true)
    expect(normalizeConfig({ notify: { daily_report: true, inventado: true } }).notify).not.toHaveProperty('inventado')
  })

  it('una sola vez por situación', async () => {
    expect(await notify('critical', 'critical:x', { title: 'Canal caído', lines: ['Instagram'] })).toBe(true)
    expect(m.send).toHaveBeenCalledTimes(1)
    expect(m.create).toHaveBeenCalledWith({ data: { kind: 'notice', key: 'critical:x', content: 'Canal caído' } })
    m.findFirst.mockResolvedValue({ id: 'ya' })
    expect(await notify('critical', 'critical:x', { title: 'Canal caído', lines: [] })).toBe(false)
    expect(m.send).toHaveBeenCalledTimes(1)
  })

  it('un aviso apagado no se envía', async () => {
    expect(await notify('daily_report', 'daily:1', { title: 'Informe', lines: [] })).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
  })

  it('las propuestas se agrupan en ventanas de 2 horas', () => {
    const t = new Date('2026-10-02T15:10:00Z')
    expect(approvalsKey(t)).toBe(approvalsKey(new Date('2026-10-02T15:50:00Z')))
    expect(approvalsKey(t)).not.toBe(approvalsKey(new Date('2026-10-02T17:10:00Z')))
  })

  it('el correo escapa el texto (títulos y datos de terceros no inyectan HTML)', () => {
    const html = renderNotice({ title: '<script>x</script>', lines: ['a & b\nsegunda'], path: '/admin/haggo' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &amp; b<br>segunda')
  })
})
