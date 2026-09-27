import { prisma } from '@/lib/prisma'

/**
 * The commission that actually applies. `PlatformConfig.commissionEnabled` is the master switch: while it is
 * off nobody pays a commission (0 % client, 0 % partner), whatever rates are stored. Bookings save the
 * effective rates when they are created, so what was agreed then is what is charged later.
 */

export const DEFAULT_COMMISSION = { clientCommissionRate: 5, partnerCommissionRate: 10 } as const

export type CommissionConfig = {
  commissionEnabled: boolean | null
  clientCommissionRate: number | null
  partnerCommissionRate: number | null
}

export type EffectiveRates = { enabled: boolean; client: number; partner: number }

const safeRate = (n: unknown, fallback: number) => {
  if (n === null || n === undefined) return fallback
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.min(v, 100)
}

export function effectiveRates(config: CommissionConfig | null | undefined): EffectiveRates {
  if (!config || !config.commissionEnabled) return { enabled: false, client: 0, partner: 0 }
  return {
    enabled: true,
    client: safeRate(config.clientCommissionRate, DEFAULT_COMMISSION.clientCommissionRate),
    partner: safeRate(config.partnerCommissionRate, DEFAULT_COMMISSION.partnerCommissionRate),
  }
}

/** The rate saved on the booking when there is one, else the current effective one. */
export function rateOrEffective(saved: number | null | undefined, effective: number) {
  return saved !== null && saved !== undefined ? safeRate(saved, 0) : effective
}

/** What the client pays: the partner's price plus the client commission (whole pesos). */
export function clientBreakdown(servicePrice: number, clientRate: number) {
  const serviceAmount = Number(servicePrice)
  const clientCommissionRate = safeRate(clientRate, 0)
  const clientCommission = Math.round((serviceAmount * clientCommissionRate) / 100)
  return { serviceAmount, clientCommission, clientCommissionRate, totalAmount: serviceAmount + clientCommission }
}

/** PlatformConfig without creating it: the row named 'default', else the oldest one, else null. */
export async function loadPlatformConfigRow() {
  return (await prisma.platformConfig.findFirst({ where: { key: 'default' } })) || (await prisma.platformConfig.findFirst({ orderBy: { createdAt: 'asc' } }))
}

export async function loadEffectiveRates(): Promise<EffectiveRates> {
  return effectiveRates(await loadPlatformConfigRow())
}

/** Client and partner rates for an existing booking: the saved ones, else the effective ones today. */
export async function bookingRates(booking: { clientCommissionRate: number | null; partnerCommissionRate: number | null }) {
  const needsCurrent = booking.clientCommissionRate === null || booking.clientCommissionRate === undefined
    || booking.partnerCommissionRate === null || booking.partnerCommissionRate === undefined
  const current = needsCurrent ? await loadEffectiveRates() : { enabled: false, client: 0, partner: 0 }
  return {
    client: rateOrEffective(booking.clientCommissionRate, current.client),
    partner: rateOrEffective(booking.partnerCommissionRate, current.partner),
    source: needsCurrent ? ('platform' as const) : ('booking' as const),
  }
}
