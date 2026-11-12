/** Constantes de SEO compartidas por las páginas públicas. Puro. */

export const SITE_URL = 'https://www.lohaggo.com'
export const SITE_NAME = 'LoHaggo'
export const CONTACT_EMAIL = 'hola@lohaggo.com'

/** Imagen por defecto al compartir cualquier página (1200x630, public/og-default.png). */
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}/og-default.png`

export const defaultOgImages = (alt = 'LoHaggo: servicios profesionales a domicilio en Medellín') => [
  { url: DEFAULT_OG_IMAGE_URL, width: 1200, height: 630, alt },
]

/** «$85.000» */
export const pesosCO = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
