'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Play, Trash2 } from 'lucide-react'
import { api } from '@/components/admin/marketing/shared'
import { videoPosterUrl } from '@/lib/marketing/media'
import type { Media, Post } from '@/components/admin/marketing/editor/types'

const MAX_IMAGE = 20 * 1024 * 1024
const MAX_VIDEO = 1024 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime'
const ACCEPTED = ACCEPT.split(',')

type Upload = { name: string; progress: number; error?: string }

/** Browser → Cloudinary directly (signed by our server), then the file is recorded on the post. */
type Sign = { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string; allowedFormats: string; resourceType: 'image' | 'video' }

function uploadToCloudinary(file: File, sign: Sign, onProgress: (p: number) => void) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('api_key', sign.apiKey)
    form.append('timestamp', String(sign.timestamp))
    form.append('signature', sign.signature)
    form.append('folder', sign.folder)
    form.append('allowed_formats', sign.allowedFormats)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(new Error(data?.error?.message || 'Cloudinary rechazó el archivo'))
      } catch {
        reject(new Error('Respuesta inválida de Cloudinary'))
      }
    }
    xhr.onerror = () => reject(new Error('No se pudo subir el archivo'))
    xhr.send(form)
  })
}

export default function MediaManager({ post, editable, onChange }: { post: Post; editable: boolean; onChange: (p: Post) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      if (!ACCEPTED.includes(file.type)) { setError(`${file.name}: formato no admitido (JPG, PNG, WebP, GIF, MP4 o MOV)`); continue }
      if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) { setError(`${file.name}: supera el tamaño máximo (${isVideo ? '1 GB' : '20 MB'})`); continue }
      setUploads((u) => [...u, { name: file.name, progress: 0 }])
      const setP = (patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, ...patch } : x)))
      try {
        const sign = await api<Sign>('/api/admin/marketing/media-sign', { method: 'POST', json: { postId: post.id, kind: isVideo ? 'video' : 'image' } })
        const r = await uploadToCloudinary(file, sign, (progress) => setP({ progress }))
        const d = await api<{ post: Post }>(`/api/admin/marketing/posts/${post.id}/media`, {
          method: 'POST',
          json: {
            url: r.secure_url, publicId: r.public_id, mime: file.type, bytes: r.bytes, width: r.width, height: r.height,
            durationSec: typeof r.duration === 'number' ? r.duration : null,
          },
        })
        onChange(d.post)
        setUploads((u) => u.filter((x) => x.name !== file.name))
      } catch (err) {
        setP({ error: err instanceof Error ? err.message : 'Error' })
      }
    }
  }

  async function mutate(req: Promise<{ post: Post }>, id: string) {
    setBusy(id)
    try { onChange((await req).post) } catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(null) }
  }
  const move = (m: Media, dir: number) => {
    const order = post.media.map((x) => x.id)
    const i = order.indexOf(m.id)
    const j = i + dir
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    mutate(api(`/api/admin/marketing/posts/${post.id}/media`, { method: 'PATCH', json: { order } }), m.id)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Imágenes y videos <span className="font-normal text-gray-400">({post.media.length}/10)</span></p>
        {editable && post.media.length < 10 && (
          <>
            <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><ImagePlus size={14} /> Subir</button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {uploads.map((u) => (
        <div key={u.name} className="rounded-xl bg-gray-50 px-3 py-2 text-xs">
          <div className="flex justify-between"><span className="truncate">{u.name}</span><span className={u.error ? 'text-red-600' : 'text-gray-500'}>{u.error || `${u.progress}%`}</span></div>
          {!u.error && <div className="mt-1 h-1 rounded bg-gray-200"><div className="h-1 rounded bg-primary-500" style={{ width: `${u.progress}%` }} /></div>}
          {u.error && <button onClick={() => setUploads((l) => l.filter((x) => x.name !== u.name))} className="mt-1 text-gray-500 underline">Quitar</button>}
        </div>
      ))}
      {post.media.length === 0 && !uploads.length ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">Instagram necesita al menos una imagen o video. Se suben directo a Cloudinary; cada red recibe la versión convertida que acepta.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {post.media.map((m, i) => (
            <div key={m.id} className="group relative overflow-hidden rounded-xl bg-gray-100">
              <img src={m.kind === 'video' ? videoPosterUrl(m.url) || '' : m.url} alt={m.alt || ''} className="aspect-square w-full object-cover" />
              {m.kind === 'video' && <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] text-white"><Play size={9} />{m.durationSec ? `${Math.round(m.durationSec)} s` : ''}</span>}
              <span className="absolute right-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">{i + 1}</span>
              {editable && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => move(m, -1)} disabled={i === 0} className="text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                  <button onClick={() => { const alt = window.prompt('Texto alternativo (describe la imagen para accesibilidad y SEO)', m.alt || ''); if (alt !== null) mutate(api(`/api/admin/marketing/posts/${post.id}/media`, { method: 'PATCH', json: { mediaId: m.id, alt } }), m.id) }} className="text-[10px] text-white underline">alt</button>
                  <button onClick={() => { if (window.confirm('¿Quitar este archivo de la publicación?')) mutate(api(`/api/admin/marketing/posts/${post.id}/media?mediaId=${m.id}`, { method: 'DELETE' }), m.id) }} className="text-white"><Trash2 size={13} /></button>
                  <button onClick={() => move(m, 1)} disabled={i === post.media.length - 1} className="text-white disabled:opacity-30"><ChevronRight size={14} /></button>
                </div>
              )}
              {busy === m.id && <div className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 size={16} className="animate-spin" /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
