/**
 * Qué páginas públicas indexa Google. Perfiles de socio sin contenido propio y ciudades que aún no abren
 * son páginas delgadas: salen con noindex y fuera del sitemap. Puro.
 */

const MIN_BIO_CHARS = 20

export type IndexablePartner = {
  totalReviews: number | null | undefined
  bio?: string | null
  image?: string | null
}

/** Un perfil se indexa con al menos 1 reseña, o con biografía propia y foto. */
export function partnerIsIndexable(p: IndexablePartner): boolean {
  if ((p.totalReviews ?? 0) >= 1) return true
  const hasBio = (p.bio ?? '').trim().length >= MIN_BIO_CHARS
  const hasPhoto = Boolean((p.image ?? '').trim())
  return hasBio && hasPhoto
}

/** Solo las ciudades abiertas se indexan; las que llegan pronto muestran contenido pero con noindex. */
export function cityIsIndexable(status: string | null | undefined): boolean {
  return status === 'ACTIVE'
}

/** Solo los perfiles con al menos una reseña se enlazan desde las páginas de servicio. */
export function partnerIsLinkable(p: { totalReviews: number | null | undefined }): boolean {
  return (p.totalReviews ?? 0) >= 1
}
