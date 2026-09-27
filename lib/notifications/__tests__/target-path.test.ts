import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info() {}, warn() {}, error() {} }) }))
vi.mock('@/lib/notifications/push-sender', () => ({ sendPushToUser: vi.fn() }))
vi.mock('@/lib/messaging/providers', () => ({ sendMessageViaProvider: vi.fn() }))
vi.mock('@/lib/messaging/provider-config', () => ({ getMessagingProviderRuntimeConfig: vi.fn() }))
vi.mock('@/lib/notifications/automation-config', () => ({ getNotificationAutomationSnapshot: vi.fn(), isNotificationChannelEnabled: vi.fn() }))
vi.mock('@/lib/notifications/email-templates', () => ({ renderNotificationChannelTemplate: vi.fn(), resolveNotificationChannelTemplate: vi.fn() }))
vi.mock('@/lib/notifications/user-preferences', () => ({ mapUserChannelPreference: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: {} }))
vi.mock('@/lib/supabase-admin', () => ({ emitUserNotificationBroadcast: vi.fn() }))

import { PUSH_NOT_DELIVERABLE, notificationTargetPath } from '@/lib/notifications/notificationService'

describe('destino del push y del enlace', () => {
  it('usa data.url cuando es una ruta interna', () => {
    expect(notificationTargetPath('NEW_PROPOSAL', 'CLIENT', { url: '/dashboard?tab=requests' })).toBe('/dashboard?tab=requests')
    expect(notificationTargetPath('NEW_MESSAGE', 'CLIENT', { url: 'https://evil.example' })).toBe('/dashboard')
    expect(notificationTargetPath('NEW_MESSAGE', 'CLIENT', { url: '//evil.example' })).toBe('/dashboard')
  })
  it('sin url: el destino del tipo, no /notifications', () => {
    expect(notificationTargetPath('BOOKING_CONFIRMED', 'PARTNER')).toBe('/partner?tab=bookings')
    expect(notificationTargetPath('REQUEST_EXPIRING_SOON', 'CLIENT')).toBe('/dashboard?tab=requests')
  })
  it('sin suscripción o suscripción vencida no cuenta como fallo', () => {
    for (const code of ['NO_SUBSCRIPTION', 'INVALID_SUBSCRIPTION', '404', '410']) expect(PUSH_NOT_DELIVERABLE.has(code)).toBe(true)
    expect(PUSH_NOT_DELIVERABLE.has('VAPID_NOT_CONFIGURED')).toBe(false)
  })
})
