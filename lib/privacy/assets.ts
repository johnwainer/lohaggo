import { cloudinaryService } from '@/lib/cloudinary'

export type AssetType = 'image' | 'raw' | 'video'

/** A stored file as «type:publicId», so a retry knows which Cloudinary resource type to destroy. */
export type AssetRef = string

const TYPES: AssetType[] = ['image', 'raw', 'video']

export const assetRef = (type: AssetType, publicId: string): AssetRef => `${type}:${publicId}`

export function parseAssetRef(ref: AssetRef): { type: AssetType; publicId: string } | null {
  const i = ref.indexOf(':')
  if (i < 1) return null
  const type = ref.slice(0, i) as AssetType
  const publicId = ref.slice(i + 1)
  return TYPES.includes(type) && publicId ? { type, publicId } : null
}

/**
 * The asset behind a stored URL in LoHaggo's own Cloudinary cloud (res.cloudinary.com is shared by every customer).
 * Handles `/<cloud>/<type>/upload/[transformations/][v123/]<publicId>[.ext]`; raw files keep their extension in the id.
 * A stored `publicId` wins over what the URL says. Returns null for anything that is not ours.
 */
export function assetFromUrl(url: string | null | undefined, publicId: string | null | undefined, cloud: string | null): AssetRef | null {
  if (!url || !cloud) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.hostname !== 'res.cloudinary.com') return null
  const m = u.pathname.match(/^\/([^/]+)\/(image|raw|video)\/upload\/(.+)$/)
  if (!m || m[1] !== cloud) return null
  const type = m[2] as AssetType
  if (publicId) return assetRef(type, publicId)
  const segs = m[3].split('/').map((s) => decodeURIComponent(s))
  const v = segs.findIndex((s) => /^v\d+$/.test(s))
  const rest = v >= 0 ? segs.slice(v + 1) : segs.filter((s) => !s.includes(',') && !/^[a-z]{1,3}_[^/]+$/.test(s))
  if (!rest.length) return null
  const last = rest[rest.length - 1]
  if (type !== 'raw') rest[rest.length - 1] = last.replace(/\.[A-Za-z0-9]{2,5}$/, '')
  return assetRef(type, rest.join('/'))
}

export type DeleteAssetsResult = { deleted: number; notFound: number; failed: number; pending: AssetRef[]; errors: string[] }

/**
 * Destroys files at the storage provider. Best-effort and idempotent: a file that is already gone counts as done,
 * a failure keeps the ref in `pending` so the caller can store it and retry later. Never throws.
 */
export async function deleteAssets(refs: AssetRef[]): Promise<DeleteAssetsResult> {
  const out: DeleteAssetsResult = { deleted: 0, notFound: 0, failed: 0, pending: [], errors: [] }
  const unique = Array.from(new Set(refs))
  if (!unique.length) return out
  if (!cloudinaryService.isEnabled()) {
    out.failed = unique.length
    out.pending = unique
    out.errors.push('Cloudinary no está configurado')
    return out
  }
  for (const ref of unique) {
    const parsed = parseAssetRef(ref)
    if (!parsed) {
      out.failed++
      out.errors.push(`Referencia inválida: ${ref}`)
      continue
    }
    try {
      const r = await cloudinaryService.destroy(parsed.publicId, parsed.type)
      if (r === 'ok') out.deleted++
      else out.notFound++
    } catch (err) {
      out.failed++
      out.pending.push(ref)
      out.errors.push(`${ref}: ${err instanceof Error ? err.message : 'error'}`.slice(0, 200))
    }
  }
  return out
}

const PENDING_MARK = '[archivos-pendientes]'

/** Refs still to destroy, as kept in the DataRequest notes (one JSON line after the marker). */
export function pendingFromNotes(notes: string | null | undefined): AssetRef[] {
  const m = notes?.match(/\[archivos-pendientes\] (\[.*\])/)
  if (!m) return []
  try {
    const list = JSON.parse(m[1])
    return Array.isArray(list) ? list.filter((r): r is string => typeof r === 'string') : []
  } catch {
    return []
  }
}

/** Replaces the pending-files line of the notes (removes it when nothing is left). */
export function notesWithPending(notes: string | null | undefined, refs: AssetRef[]): string {
  const base = (notes ?? '').replace(/\n?\[archivos-pendientes\] \[.*\]/, '').trimEnd()
  return refs.length ? `${base}\n${PENDING_MARK} ${JSON.stringify(refs)}`.trim() : base
}

export const storageSummary = (s: { deleted: number; notFound: number; failed: number }) =>
  `${s.deleted} archivos borrados del almacenamiento${s.notFound ? `, ${s.notFound} ya no existían` : ''}${s.failed ? `, ${s.failed} fallaron (quedan pendientes para reintentar)` : ''}`
