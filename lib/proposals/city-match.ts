/**
 * The partner offers each service in one city (PartnerService.city); a request or booking in another city
 * is a mistake (usually the service was registered with the wrong city). Pure: also used by the panels.
 */

export const CITY_NAME: Record<string, string> = { MEDELLIN: 'Medellín', BOGOTA: 'Bogotá', CALI: 'Cali', BARRANQUILLA: 'Barranquilla' }

export function cityName(city: string | null | undefined): string {
  if (!city) return 'sin ciudad'
  return CITY_NAME[city] ?? city.charAt(0) + city.slice(1).toLowerCase()
}

/** Whether the partner's service city differs from the request's (no row = no service, also a mismatch). */
export function serviceCityMismatch(serviceCity: string | null | undefined, requestCity: string | null | undefined): boolean {
  if (!requestCity) return false
  return serviceCity !== requestCity
}

/** What the partner reads when they try to propose on a request outside their service's city. */
export function partnerCityMismatchMessage(serviceName: string, serviceCity: string | null | undefined, requestCity: string) {
  if (!serviceCity) return `No ofreces ${serviceName} en ${cityName(requestCity)}. Agrégalo en Mis servicios para enviar propuestas.`
  return `Tu servicio ${serviceName} está registrado en ${cityName(serviceCity)} y esta solicitud es en ${cityName(requestCity)}. Si trabajas en ${cityName(requestCity)}, cambia la ciudad en Mis servicios y vuelve a intentarlo.`
}

/** What the client reads when the proposal they accept comes from a partner registered in another city. */
export function clientCityMismatchMessage(requestCity: string) {
  return `Este socio no tiene el servicio registrado en ${cityName(requestCity)}, así que no podemos crear la reserva. Elige otra propuesta o escríbenos y lo resolvemos.`
}

type WithCity = { id: string; city?: string | null; serviceId?: string | null }

/**
 * Items (bookings or opportunities) whose city differs from the partner's service city for that service.
 * `services` are the partner's PartnerService rows ({ serviceId, city }); items whose service the partner
 * no longer has are left out (nothing to compare with).
 */
export function cityMismatches<T extends WithCity>(items: T[], services: Array<{ serviceId: string; city: string }>) {
  const byService = new Map(services.map((s) => [s.serviceId, s.city]))
  const out: Array<{ item: T; serviceCity: string; itemCity: string }> = []
  for (const item of items) {
    const serviceId = item.serviceId ?? null
    if (!serviceId || !item.city) continue
    const serviceCity = byService.get(serviceId)
    if (serviceCity && serviceCity !== item.city) out.push({ item, serviceCity, itemCity: item.city })
  }
  return out
}
