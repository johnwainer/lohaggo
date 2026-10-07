'use client'

import { useCallback, useEffect, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { PhotoGroups, type BookingPhotoItem } from '@/components/bookings/BookingPhotos'

const MAX_PHOTOS = 10

/** Downscales a phone photo to ≤1920px JPEG before upload; falls back to the original file. */
function compress(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve(file)
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => resolve(file)
      img.onload = () => {
        const scale = Math.min(1, 1920 / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.8)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Partner block «Fotos del trabajo»: «Antes» (from CONFIRMED) and «Después» (from IN_PROGRESS) camera
 * buttons plus thumbnails. `only` limits it to one kind (the «después» prompt after completing).
 */
export default function WorkPhotosEditor({ bookingId, status, only, onUploaded }: {
  bookingId: string
  status: string
  only?: 'before' | 'after'
  onUploaded?: () => void
}) {
  const [photos, setPhotos] = useState<BookingPhotoItem[]>([])
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/photos`)
      if (res.ok) setPhotos((await res.json()).photos ?? [])
    } catch { /* offline: keep what we have */ }
  }, [bookingId])

  useEffect(() => { void load() }, [load])

  const upload = async (kind: 'before' | 'after', fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setError('')
    const left = MAX_PHOTOS - photos.length
    if (files.length > left) {
      setError(left > 0 ? `Puedes subir ${left} foto${left === 1 ? '' : 's'} más (máximo ${MAX_PHOTOS})` : `Ya tienes el máximo de ${MAX_PHOTOS} fotos`)
      return
    }
    setUploading(kind)
    try {
      const form = new FormData()
      for (const f of files) form.append('photos', await compress(f))
      const up = await fetch('/api/upload-photos', { method: 'POST', body: form })
      const upData = await up.json().catch(() => ({}))
      if (!up.ok || !Array.isArray(upData.urls)) throw new Error(upData.error || 'No se pudieron subir las fotos')
      const res = await fetch(`/api/bookings/${bookingId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: upData.urls, kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudieron guardar las fotos')
      setPhotos(data.photos ?? [])
      onUploaded?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron subir las fotos')
    } finally {
      setUploading(null)
    }
  }

  const canBefore = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && only !== 'after'
  const canAfter = ['IN_PROGRESS', 'COMPLETED'].includes(status) && only !== 'before'
  const full = photos.length >= MAX_PHOTOS

  // No `capture`: phones then offer both the camera and the gallery.
  const button = (kind: 'before' | 'after', label: string) => (
    <label
      className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 ${
        kind === 'after' ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
      } ${uploading || full ? 'pointer-events-none opacity-60' : ''}`}
    >
      {uploading === kind ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
      <span aria-hidden="true">{uploading === kind ? 'Subiendo…' : label}</span>
      <input
        type="file"
        accept="image/*"
        multiple
        aria-label={uploading === kind ? 'Subiendo fotos…' : `Subir fotos de ${label.toLowerCase()}`}
        className="sr-only"
        disabled={!!uploading || full}
        onChange={(e) => { void upload(kind, e.target.files); e.target.value = '' }}
      />
    </label>
  )

  if (!canBefore && !canAfter) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Camera size={16} className="text-primary-600" aria-hidden="true" /> Fotos del trabajo
        </p>
        <span className="text-xs text-gray-600" aria-label={`${photos.length} de ${MAX_PHOTOS} fotos`}>{photos.length}/{MAX_PHOTOS}</span>
      </div>
      {photos.length > 0 && <div className="mb-3"><PhotoGroups photos={photos} /></div>}
      <div className="flex gap-2">
        {canBefore && button('before', 'Antes')}
        {canAfter && button('after', 'Después')}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{error}</p>}
    </div>
  )
}
