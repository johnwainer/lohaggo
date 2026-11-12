/**
 * ONE «desde» value for a service everywhere (header, partner list, sticky bar, budget hint):
 * the cheapest price an available partner offers in the city, never below the service's base price (the
 * minimum any proposal can have); when no partner is above it, the base price. The client fee is shown next to it.
 */

export type FeeInfo = { enabled: boolean; rate: number }

export function priceFrom(service: { basePrice: number }, partnerPrices: number[]): { amount: number; source: 'partners' | 'base' } {
  const valid = partnerPrices.filter((p) => Number.isFinite(p) && p > 0)
  // Never below the base price: a proposal cannot be lower than it, and some partner prices predate that rule
  const cheapest = valid.length > 0 ? Math.max(Math.min(...valid), service.basePrice) : null
  if (cheapest !== null && cheapest > service.basePrice) return { amount: cheapest, source: 'partners' }
  return { amount: service.basePrice, source: 'base' }
}

export function priceFromLabel(source: 'partners' | 'base'): string {
  return source === 'partners' ? 'Desde (el precio más bajo de un socio)' : 'Desde (precio base)'
}

export function clientFee(amount: number, fee: FeeInfo | null | undefined): number {
  if (!fee?.enabled || !(fee.rate > 0)) return 0
  return Math.round((amount * fee.rate) / 100)
}

/** «Sin tarifa de servicio» when commission is off; otherwise «+ tarifa de servicio 5 % (≈ $X)». Null while unknown. */
export function feeNote(amount: number, fee: FeeInfo | null | undefined, format: (n: number) => string): string | null {
  if (!fee) return null
  if (!fee.enabled || !(fee.rate > 0)) return 'Sin tarifa de servicio'
  return `+ tarifa de servicio ${fee.rate} % (≈ ${format(clientFee(amount, fee))})`
}
