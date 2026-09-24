'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Bold, Eye, Heading2, Italic, Link2, List, Pencil } from 'lucide-react'
import { LIMITS } from '@/lib/marketing/channel-rules'
import { renderMarkdown, slugify, SITE_URL } from '@/lib/marketing/seo'
import { ogImageUrl, videoPosterUrl } from '@/lib/marketing/media'
import { CHANNEL_NAME, input } from '@/components/admin/marketing/shared'
import type { Media, Post, Validation, Variant } from '@/components/admin/marketing/editor/types'

const Counter = ({ value, max, label }: { value: number; max: number; label: string }) => (
  <span className={value > max ? 'font-semibold text-red-600' : value > max * 0.9 ? 'text-amber-700' : 'text-gray-500'}>{value}/{max} {label}</span>
)

function Issues({ v }: { v: Validation | undefined }) {
  if (!v || (!v.errors.length && !v.warnings.length)) return null
  return (
    <div className="space-y-1">
      {v.errors.map((e) => <p key={e.code + e.message} className="flex gap-1.5 text-xs text-red-700"><AlertCircle size={13} className="mt-0.5 shrink-0" /> {e.message}</p>)}
      {v.warnings.map((e) => <p key={e.code + e.message} className="flex gap-1.5 text-xs text-amber-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {e.message}</p>)}
    </div>
  )
}

function Thumb({ m, className = '' }: { m: Media; className?: string }) {
  return <img src={m.kind === 'video' ? videoPosterUrl(m.url) || '' : m.url} alt={m.alt || ''} className={`object-cover ${className}`} />
}

function SocialPreview({ channel, body, media, accountName, link }: { channel: 'FACEBOOK' | 'INSTAGRAM'; body: string; media: Media[]; accountName: string; link: string | null }) {
  const [more, setMore] = useState(false)
  const cut = channel === 'INSTAGRAM' ? 125 : 480
  const text = !more && body.length > cut ? `${body.slice(0, cut)}… ` : body
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px] shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500" />
        <span className="font-semibold text-gray-900">{accountName}</span>
        <span className="ml-auto text-[11px] text-gray-400">Vista previa aproximada</span>
      </div>
      {channel === 'FACEBOOK' && <p className="whitespace-pre-wrap break-words px-3 pb-2 text-gray-900">{text}{body.length > cut && <button onClick={() => setMore(!more)} className="text-gray-500">{more ? ' ver menos' : 'ver más'}</button>}</p>}
      {media[0] ? (
        <div className="relative bg-gray-100">
          <Thumb m={media[0]} className={`w-full ${channel === 'INSTAGRAM' ? 'aspect-[4/5]' : 'max-h-[380px]'}`} />
          {media.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 text-[11px] text-white">1/{media.length}</span>}
        </div>
      ) : channel === 'FACEBOOK' && link ? (
        <div className="mx-3 mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-500 truncate">{link}</div>
      ) : null}
      {channel === 'INSTAGRAM' && (
        <p className="whitespace-pre-wrap break-words px-3 py-2 text-gray-900"><span className="font-semibold">{accountName.replace(/^@/, '')}</span> {text}{body.length > cut && <button onClick={() => setMore(!more)} className="text-gray-500">{more ? ' menos' : 'más'}</button>}</p>
      )}
    </div>
  )
}

function MarkdownToolbar({ textarea, onChange }: { textarea: React.RefObject<HTMLTextAreaElement | null>; onChange: (v: string) => void }) {
  const wrap = (before: string, after = before, placeholder = 'texto') => {
    const el = textarea.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const sel = value.slice(s, e) || placeholder
    onChange(`${value.slice(0, s)}${before}${sel}${after}${value.slice(e)}`)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length) })
  }
  const line = (prefix: string) => {
    const el = textarea.current
    if (!el) return
    const { selectionStart: s, value } = el
    const start = value.lastIndexOf('\n', s - 1) + 1
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length) })
  }
  const b = 'rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800'
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={b} title="Subtítulo" onClick={() => line('## ')}><Heading2 size={15} /></button>
      <button type="button" className={b} title="Negrita" onClick={() => wrap('**')}><Bold size={15} /></button>
      <button type="button" className={b} title="Cursiva" onClick={() => wrap('*')}><Italic size={15} /></button>
      <button type="button" className={b} title="Lista" onClick={() => line('- ')}><List size={15} /></button>
      <button type="button" className={b} title="Enlace" onClick={() => wrap('[', '](https://)', 'texto del enlace')}><Link2 size={15} /></button>
    </div>
  )
}

export default function ChannelEditor({ post, variant, validation, editable, accountName, onChange, onTitle }: {
  post: Post
  variant: Variant
  validation: Validation | undefined
  editable: boolean
  accountName: string
  onChange: (patch: Partial<Variant>) => void
  onTitle: (title: string) => void
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const media = variant.mediaIds.length ? variant.mediaIds.map((id) => post.media.find((m) => m.id === id)).filter((m): m is Media => Boolean(m)) : post.media
  const s = validation?.stats
  const ch = variant.channel
  const slugTouched = useRef(Boolean(variant.slug))

  // Web: the URL follows the title until someone edits it
  useEffect(() => {
    if (ch === 'WEB' && !slugTouched.current && !variant.webPublishedAt) {
      const next = slugify(post.title)
      if (next && next !== variant.slug) onChange({ slug: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.title, ch])

  const toggleMedia = (id: string) => {
    const current = variant.mediaIds.length ? variant.mediaIds : post.media.map((m) => m.id)
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    // Selecting every file is the same as "all of them" (follows new uploads)
    onChange({ mediaIds: next.length === post.media.length ? [] : next })
  }

  const mediaPicker = post.media.length > 0 && (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-700">Archivos para {CHANNEL_NAME[ch]}</p>
      <div className="flex gap-1.5 flex-wrap">
        {post.media.map((m) => {
          const on = media.some((x) => x.id === m.id)
          return (
            <button key={m.id} type="button" disabled={!editable} onClick={() => toggleMedia(m.id)} className={`relative h-14 w-14 overflow-hidden rounded-lg ring-2 ${on ? 'ring-primary-500' : 'ring-transparent opacity-40'}`}>
              <Thumb m={m} className="h-full w-full" />
            </button>
          )
        })}
      </div>
    </div>
  )

  if (ch === 'WEB') {
    const seoTitle = variant.seoTitle || post.title
    const desc = variant.seoDescription || variant.excerpt || ''
    const images = post.media.filter((m) => m.kind === 'image')
    const cover = variant.coverUrl || images[0]?.url || null
    return (
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Título del artículo (H1)</span>
          <input className={`${input} text-lg font-semibold`} disabled={!editable} value={post.title} onChange={(e) => onTitle(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">URL</span>
          <div className="flex items-center rounded-xl border border-gray-200 text-sm focus-within:ring-2 focus-within:ring-primary-500">
            <span className="pl-3 text-gray-400 whitespace-nowrap">lohaggo.com/blog/</span>
            <input className="flex-1 min-w-0 rounded-r-xl py-2 pr-3 outline-none" disabled={!editable} value={variant.slug || ''} onChange={(e) => { slugTouched.current = true; onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }) }} />
          </div>
          {variant.webPublishedAt && <span className="block text-xs text-gray-500">Si cambias la URL de un artículo publicado, la anterior redirige a la nueva (301).</span>}
        </label>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Contenido</span>
            <div className="flex items-center gap-2">
              {!preview && editable && <MarkdownToolbar textarea={bodyRef} onChange={(body) => onChange({ body })} />}
              <button type="button" onClick={() => setPreview(!preview)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600">{preview ? <><Pencil size={12} /> Editar</> : <><Eye size={12} /> Vista previa</>}</button>
            </div>
          </div>
          {preview ? (
            <div className="min-h-[320px] rounded-xl border border-gray-200 bg-white p-4 text-[15px] leading-7 text-gray-800 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:italic [&_img]:rounded-xl" dangerouslySetInnerHTML={{ __html: renderMarkdown(variant.body) }} />
          ) : (
            <textarea ref={bodyRef} className={`${input} font-mono text-[13px] leading-6`} rows={18} disabled={!editable} value={variant.body} onChange={(e) => onChange({ body: e.target.value })} placeholder={'Escribe en Markdown:\n\n## Subtítulo\n\nPárrafo con **negrita** y un [enlace](https://www.lohaggo.com).\n\n- Punto uno\n- Punto dos'} />
          )}
          <p className="text-xs text-gray-500">{s?.words ?? 0} palabras · ~{Math.max(1, Math.round((s?.words ?? 0) / 200))} min de lectura</p>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">SEO y redes</p>
          <label className="block space-y-1">
            <span className="flex justify-between text-xs font-medium text-gray-700">Título SEO <Counter value={Array.from(seoTitle).length} max={LIMITS.WEB.seoTitleMax} label="car." /></span>
            <input className={input} disabled={!editable} value={variant.seoTitle || ''} onChange={(e) => onChange({ seoTitle: e.target.value })} placeholder={post.title} />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between text-xs font-medium text-gray-700">Meta descripción <Counter value={Array.from(variant.seoDescription || '').length} max={LIMITS.WEB.seoDescriptionMax} label="car." /></span>
            <textarea className={input} rows={2} disabled={!editable} value={variant.seoDescription || ''} onChange={(e) => onChange({ seoDescription: e.target.value })} placeholder="Lo que Google muestra bajo el título (120–160 caracteres)" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-700">Extracto (listado del blog)</span>
            <textarea className={input} rows={2} disabled={!editable} value={variant.excerpt || ''} onChange={(e) => onChange({ excerpt: e.target.value })} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Categoría</span><input className={input} disabled={!editable} value={variant.category || ''} onChange={(e) => onChange({ category: e.target.value })} placeholder="Mantenimiento" /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Etiquetas (separadas por comas)</span>
              <input className={input} disabled={!editable} defaultValue={variant.tags.join(', ')} onBlur={(e) => onChange({ tags: e.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) })} placeholder="plomería, hogar" />
            </label>
          </div>
          {images.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-700">Imagen de portada (Open Graph, 1200×630)</span>
              <div className="flex gap-1.5 flex-wrap">
                {images.map((m) => (
                  <button key={m.id} type="button" disabled={!editable} onClick={() => onChange({ coverUrl: m.url })} className={`h-12 w-20 overflow-hidden rounded-lg ring-2 ${cover === m.url ? 'ring-primary-500' : 'ring-transparent'}`}><Thumb m={m} className="h-full w-full" /></button>
                ))}
              </div>
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600">Avanzado</summary>
            <div className="mt-2 space-y-2">
              <label className="block space-y-1"><span className="font-medium text-gray-700">URL canónica (solo si el contenido original está en otro sitio)</span><input className={input} disabled={!editable} value={variant.canonicalUrl || ''} onChange={(e) => onChange({ canonicalUrl: e.target.value })} placeholder="https://" /></label>
              <label className="flex items-center gap-2"><input type="checkbox" disabled={!editable} checked={variant.noindex} onChange={(e) => onChange({ noindex: e.target.checked })} /> No indexar en Google (noindex, fuera del sitemap)</label>
            </div>
          </details>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[11px] text-gray-500 mb-1">Así se vería en Google</p>
              <p className="text-[12px] text-gray-600 truncate">{SITE_URL.replace('https://', '')} › blog › {variant.slug || '…'}</p>
              <p className="text-[16px] leading-snug text-[#1a0dab] line-clamp-1">{seoTitle}</p>
              <p className="text-[12px] text-gray-600 line-clamp-2">{desc || 'Sin meta descripción: Google elegirá un fragmento.'}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              {cover ? <img src={ogImageUrl(cover) || cover} alt="" className="aspect-[1.91/1] w-full object-cover" /> : <div className="aspect-[1.91/1] bg-gray-100" />}
              <div className="p-2"><p className="text-[10px] uppercase text-gray-400">lohaggo.com</p><p className="text-[13px] font-semibold text-gray-900 line-clamp-1">{seoTitle}</p><p className="text-[11px] text-gray-500 line-clamp-1">{desc}</p></div>
            </div>
          </div>
        </div>
        <Issues v={validation} />
      </div>
    )
  }

  const L = ch === 'INSTAGRAM' ? LIMITS.INSTAGRAM : null
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="flex justify-between text-sm font-medium text-gray-700">
              Texto
              <span className="flex gap-3 text-xs font-normal">
                {L ? <Counter value={s?.chars ?? 0} max={L.caption} label="car." /> : <span className="text-gray-500">{s?.chars ?? 0} car.</span>}
                {L ? <Counter value={s?.hashtags ?? 0} max={L.hashtags} label="#" /> : <Counter value={s?.hashtags ?? 0} max={LIMITS.FACEBOOK.recommendedHashtags} label="# recomendados" />}
                {L && <Counter value={s?.mentions ?? 0} max={L.mentions} label="@" />}
              </span>
            </span>
            <textarea className={input} rows={12} disabled={!editable} value={variant.body} onChange={(e) => onChange({ body: e.target.value })} placeholder={ch === 'INSTAGRAM' ? 'La primera línea es la que se ve antes de «más»: que enganche.' : '¿Qué quieres contar?'} />
          </label>
          {ch === 'INSTAGRAM' && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">Formato</span>
              <select className={input} disabled={!editable} value={variant.format || ''} onChange={(e) => onChange({ format: e.target.value || null })}>
                <option value="">Automático según los archivos</option>
                <option value="feed">Publicación (una imagen)</option>
                <option value="carousel">Carrusel (2 a 10 archivos)</option>
                <option value="reel">Reel (video)</option>
              </select>
            </label>
          )}
          {ch === 'FACEBOOK' && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">Enlace (opcional)</span>
              <input className={input} disabled={!editable} value={variant.linkUrl || ''} onChange={(e) => onChange({ linkUrl: e.target.value || null })} placeholder="https://www.lohaggo.com/blog/…" />
              <span className="block text-[11px] text-gray-500">Sin imágenes, Facebook muestra la tarjeta del enlace con su imagen Open Graph.</span>
            </label>
          )}
          {mediaPicker}
          <Issues v={validation} />
        </div>
        <SocialPreview channel={ch} body={variant.body} media={media} accountName={accountName} link={variant.linkUrl} />
      </div>
    </div>
  )
}
