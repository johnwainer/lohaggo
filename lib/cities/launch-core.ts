/**
 * When a city is ready to open: verified partners in each focus service (the ones with ads and demand in
 * Medellín), enough verified partners overall, and people waiting. Pure, so Haggo and the action agree.
 */

export const FOCUS_SERVICES = ['plomeria', 'electricidad', 'pintura', 'limpieza-hogar'] as const
export const LAUNCH_MIN = { perFocusService: 3, totalVerified: 15 }

export type LaunchInput = {
  city: string
  partnersByService: Array<{ slug: string; name: string; verified: number }>
  totalVerified: number
  waitlist: { clients: number; partners: number; withWhatsapp: number }
}

export function evaluateLaunch(i: LaunchInput) {
  const focus = FOCUS_SERVICES.map((slug) => i.partnersByService.find((s) => s.slug === slug) ?? { slug, name: slug, verified: 0 })
  const gaps = focus.filter((s) => s.verified < LAUNCH_MIN.perFocusService).map((s) => ({ ...s, missing: LAUNCH_MIN.perFocusService - s.verified }))
  const checks = [
    ...focus.map((s) => ({ item: `${s.name}: al menos ${LAUNCH_MIN.perFocusService} socios verificados`, ok: s.verified >= LAUNCH_MIN.perFocusService, detail: `${s.verified} hoy` })),
    { item: `Al menos ${LAUNCH_MIN.totalVerified} socios verificados en total`, ok: i.totalVerified >= LAUNCH_MIN.totalVerified, detail: `${i.totalVerified} hoy` },
    { item: 'Gente esperando en la lista de espera', ok: i.waitlist.clients > 0, detail: `${i.waitlist.clients} clientes (${i.waitlist.withWhatsapp} con WhatsApp), ${i.waitlist.partners} socios` },
  ]
  // The waitlist is not required to open: only coverage is
  const ready = gaps.length === 0 && i.totalVerified >= LAUNCH_MIN.totalVerified
  const recruit = i.partnersByService
    .filter((s) => s.verified < LAUNCH_MIN.perFocusService)
    .sort((a, b) => (FOCUS_SERVICES.includes(b.slug as never) ? 1 : 0) - (FOCUS_SERVICES.includes(a.slug as never) ? 1 : 0) || a.verified - b.verified)
    .slice(0, 8)
    .map((s) => s.name)
  return { city: i.city, ready, checks, gaps, recruitFirst: recruit }
}
