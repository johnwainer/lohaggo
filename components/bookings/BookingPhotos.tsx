'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'

export type BookingPhotoItem = { id: string; url: string; kind: string; createdAt: string }

/** Thumbnails of the partner's before/after photos of the work, fetched when the block scrolls into view. */
export default function BookingPhotos({ bookingId }: { bookingId: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [photos, setPhotos] = useState<BookingPhotoItem[] | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const ctrl = new AbortController()
    fetch(`/api/bookings/${bookingId}/photos`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d) => setPhotos(Array.isArray(d.photos) ? d.photos : []))
      .catch(() => { if (!ctrl.signal.aborted) setPhotos([]) })
    return () => ctrl.abort()
  }, [bookingId, visible])

  if (photos && photos.length === 0) return <div ref={ref} />

  return (
    <div ref={ref}>
      {photos && (
        <div className="rounded-2xl border border-gray-100 bg-white p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Camera size={16} className="text-primary-600" aria-hidden="true" /> Fotos del trabajo
          </p>
          <PhotoGroups photos={photos} />
        </div>
      )}
    </div>
  )
}

export function PhotoGroups({ photos }: { photos: BookingPhotoItem[] }) {
  const groups = [
    { kind: 'before', label: 'Antes' },
    { kind: 'after', label: 'Después' },
  ].map((g) => ({ ...g, items: photos.filter((p) => p.kind === g.kind) })).filter((g) => g.items.length)

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.kind}>
          <p className="mb-1 text-xs font-medium text-gray-600">{g.label}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {g.items.map((p, i) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Ver foto ${g.label.toLowerCase()} ${i + 1} de ${g.items.length} (se abre en otra pestaña)`} className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Foto ${g.label.toLowerCase()}`} loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
