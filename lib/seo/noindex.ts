import type { Metadata } from 'next'

/** Páginas privadas o de flujo (sesión, cuenta, enlaces de un solo uso): fuera del índice de Google. */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}
