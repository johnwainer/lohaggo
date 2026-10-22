/**
 * The client's transfer receipt (a photo uploaded with /api/upload-photos), kept in Payment.metadata as
 * { receiptUrl }. Pure helpers: the raw metadata never goes to the browser, only the URL.
 */

/**
 * A receipt URL we accept: an upload of our own Cloudinary account (its cloud name), or one of our upload
 * paths. Any other host or account could be a page someone else controls shown as «Ver comprobante».
 */
export function validReceiptUrl(v: unknown, cloudName: string | undefined = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  const localPath = (p: string) => /^\/uploads\/[\w./-]+$/.test(p) && !p.includes('..')
  if (localPath(s)) return s
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' || u.username || u.password) return null
    if (u.hostname === 'res.cloudinary.com') return cloudName && u.pathname.startsWith(`/${cloudName}/image/upload/`) ? u.toString() : null
    if (u.hostname === 'www.lohaggo.com' || u.hostname === 'lohaggo.com') return localPath(u.pathname) ? u.toString() : null
    return null
  } catch {
    return null
  }
}

export function receiptOf(metadata: string | null | undefined): string | null {
  if (!metadata) return null
  try {
    return validReceiptUrl((JSON.parse(metadata) as { receiptUrl?: unknown }).receiptUrl)
  } catch {
    return null
  }
}

/** Payment.metadata with the receipt set (or removed with null), keeping any other key. */
export function withReceipt(metadata: string | null | undefined, url: string | null): string | null {
  let base: Record<string, unknown> = {}
  try {
    const parsed = metadata ? JSON.parse(metadata) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed as Record<string, unknown>
  } catch {
    base = {}
  }
  if (url) base.receiptUrl = url
  else delete base.receiptUrl
  return Object.keys(base).length ? JSON.stringify(base) : null
}

/** A payment row as the panels see it: the receipt URL instead of the raw metadata. */
export function paymentView<T extends { metadata?: string | null }>(p: T | null | undefined): Omit<T, 'metadata'> & { receiptUrl: string | null } {
  if (!p) return { receiptUrl: null } as Omit<T, 'metadata'> & { receiptUrl: string | null }
  const { metadata, ...rest } = p
  return { ...rest, receiptUrl: receiptOf(metadata) }
}
