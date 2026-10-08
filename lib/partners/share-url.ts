/** Links to a partner's public profile, tagged so analytics can tell visits that came from the partner sharing it. Safe in the browser. */
export const PROFILE_BASE = 'https://www.lohaggo.com/pro/'

/** How the link travels: the WhatsApp button, a copied link, the QR, the status image */
export type ShareMedium = 'whatsapp' | 'enlace' | 'qr' | 'imagen' | 'compartir'

/** The query that marks a visit as coming from a partner sharing their profile */
export function shareQuery(medium: ShareMedium) {
  return `utm_source=socio&utm_medium=${medium}&utm_campaign=perfil_socio`
}

export function partnerShareUrl(slug: string, medium: ShareMedium) {
  return `${PROFILE_BASE}${slug}?${shareQuery(medium)}`
}
