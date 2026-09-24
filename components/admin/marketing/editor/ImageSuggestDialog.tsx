'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, ImageIcon, Loader2, Search, Wand2, X } from 'lucide-react'
import { api, input, type MkChannel } from '@/components/admin/marketing/shared'
import { STYLE_PRESETS, defaultOrientation, servicePrompt, type ImageCandidate, type Orientation } from '@/lib/marketing/images-core'
import type { Post } from '@/components/admin/marketing/editor/types'

export type ImageSummary = { pexels: boolean; provider: string; providerLabel: string; providerReady: boolean; providerReason: string | null; supportsReference: boolean; costPerImageUsd: number }
export type BrandKitView = { logoUrl: string | null; logoPublicId: string | null; autoApply: boolean } | null

const ORIENT_LABEL: Record<Orientation, string> = { portrait: 'Vertical 4:5 (Instagram)', square: 'Cuadrada 1:1', landscape: 'Horizontal (Facebook, blog)' }

/**
 * "Sugerir imágenes": starts from the catalog service the post is about (searched on Pexels right
 * away, it is free); the search, the AI description and every option stay editable before generating.
 */
export default function ImageSuggestDialog({ post, channel, format, text, brief, summary, kit, onClose, onImported }: {
  post: Post
  channel: MkChannel
  format: string | null
  text: string
  brief: string
  summary: ImageSummary
  kit: BrandKitView
  onClose: () => void
  onImported: (p: Post) => void
}) {
  const [tab, setTab] = useState<'pexels' | 'ai'>(summary.pexels ? 'pexels' : 'ai')
  const [orientation, setOrientation] = useState<Orientation>(defaultOrientation(channel, format))
  const [brand, setBrand] = useState(Boolean(kit?.logoPublicId && kit.autoApply))
  const [services, setServices] = useState<string[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [service, setService] = useState('')
  const [query, setQuery] = useState('')
  const [prompt, setPrompt] = useState('')
  const [alt, setAlt] = useState('')
  const [style, setStyle] = useState<string>(STYLE_PRESETS[0][1])
  const [count, setCount] = useState(2)
  const [referenceId, setReferenceId] = useState('')
  const [suggesting, setSuggesting] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [results, setResults] = useState<ImageCandidate[]>([])
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const images = post.media.filter((m) => m.kind === 'image')

  // The service the post is about (detected from the catalog, no AI): photo search and AI description start from it
  const pickService = (name: string, run = true) => {
    setService(name)
    setQuery(name)
    setPrompt(name ? servicePrompt(name) : '')
    setAlt(name ? `Profesional de ${name.toLowerCase()} – LoHaggo` : '')
    setResults([])
    if (run && name && summary.pexels) search(name)
  }
  useEffect(() => {
    api<{ services: string[]; matched: string[] }>('/api/admin/marketing/images', { method: 'POST', json: { action: 'suggest', postId: post.id } })
      .then((d) => {
        setServices(d.services)
        setMatched(d.matched)
        if (d.matched[0]) pickService(d.matched[0], tab === 'pexels')
        else setQuery(post.title)
      })
      .catch(() => setQuery(post.title))
      .finally(() => setSuggesting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function search(q = query, p = 1) {
    if (!q.trim()) return
    setBusy('search'); setError(null)
    try {
      const d = await api<{ results: ImageCandidate[] }>('/api/admin/marketing/images', { method: 'POST', json: { action: 'search', postId: post.id, query: q, orientation, page: p } })
      setResults((r) => (p === 1 ? d.results : [...r, ...d.results]))
      setPage(p)
      if (!d.results.length && p === 1) setError('Sin resultados: prueba con otras palabras.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(null) }
  }

  async function generate() {
    setBusy('generate'); setError(null)
    try {
      const d = await api<{ results: ImageCandidate[] }>('/api/admin/marketing/images', { method: 'POST', json: { action: 'generate', postId: post.id, prompt, style, orientation, count, referenceMediaId: referenceId || undefined } })
      setResults(d.results)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(null) }
  }

  async function use(c: ImageCandidate) {
    setBusy(c.id); setError(null)
    try {
      const d = await api<{ post: Post }>('/api/admin/marketing/images', { method: 'POST', json: { action: 'import', postId: post.id, candidate: c, brand, alt: alt || c.alt } })
      onImported(d.post)
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(null) }
  }

  const tabBtn = (k: 'pexels' | 'ai', label: string, disabled: boolean, hint?: string | null) => (
    <button disabled={disabled} title={hint || undefined} onClick={() => { setTab(k); setResults([]) }} className={`px-3 py-2 text-sm border-b-2 -mb-px disabled:opacity-40 ${tab === k ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-500'}`}>{label}</button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><ImageIcon size={18} /> Sugerir imágenes</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {tabBtn('pexels', 'Fotos gratis (Pexels)', !summary.pexels, summary.pexels ? null : 'Falta la clave de Pexels')}
          {tabBtn('ai', `Generar con IA${summary.providerReady ? ` · ${summary.providerLabel}` : ''}`, !summary.providerReady, summary.providerReason)}
        </div>
        {!summary.pexels && !summary.providerReady && (
          <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">No hay fuentes de imágenes configuradas. El administrador de la plataforma las activa en Publicaciones → Marca e imágenes.</p>
        )}

        <div className="space-y-1.5">
          <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Servicio</span>
            <select className={input} value={service} onChange={(e) => pickService(e.target.value)} disabled={suggesting}>
              <option value="">{suggesting ? 'Detectando el servicio…' : 'Elige el servicio de la publicación'}</option>
              {services.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {matched.length > 1 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-gray-500">La publicación también habla de:</span>
              {matched.filter((m) => m !== service).map((m) => <button key={m} onClick={() => pickService(m)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">{m}</button>)}
            </div>
          )}
          {!suggesting && !matched.length && <p className="text-[11px] text-gray-500">No se detectó un servicio del catálogo en la publicación: elígelo arriba o escribe la búsqueda.</p>}
        </div>

        {/* Options, all editable before sending anything */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Formato</span>
            <select className={input} value={orientation} onChange={(e) => { setOrientation(e.target.value as Orientation); setResults([]) }}>
              {(Object.keys(ORIENT_LABEL) as Orientation[]).map((o) => <option key={o} value={o}>{ORIENT_LABEL[o]}</option>)}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-700">Logo</span>
            {kit?.logoPublicId ? (
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={brand} onChange={(e) => setBrand(e.target.checked)} />
                {kit.logoUrl && <img src={kit.logoUrl} alt="" className="h-5 w-auto" />} Poner el logo en la imagen
              </label>
            ) : (
              <p className="text-xs text-gray-500 rounded-xl border border-dashed border-gray-200 px-3 py-2">Sin logo configurado. <Link href="/admin/marketing" className="underline">Súbelo en Marca e imágenes</Link>.</p>
            )}
          </div>
        </div>
        <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Texto alternativo (accesibilidad y SEO)</span>
          <input className={input} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe la imagen en una frase" />
        </label>

        {tab === 'pexels' ? (
          <div className="space-y-2">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search() }}>
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                <input className={`${input} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qué buscar (por defecto, el nombre del servicio)" />
              </div>
              <button disabled={busy === 'search' || !query.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === 'search' ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Descripción de la imagen</span>
              <textarea className={input} rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Escena, sujeto, encuadre, luz y ambiente" />
              <span className="block text-[11px] text-gray-500">Siempre se añade: sin textos, letras ni logotipos dibujados (el logo real lo pone la plataforma).</span>
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-700">Estilo</span>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map(([k, v]) => <button key={k} onClick={() => setStyle(v)} className={`rounded-full px-2.5 py-1 text-xs border ${style === v ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700'}`}>{k}</button>)}
              </div>
              <input className={`${input} text-xs`} value={style} onChange={(e) => setStyle(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs font-medium text-gray-700">Cuántas opciones</span>
                <select className={input} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}{summary.costPerImageUsd ? ` (≈ US$${(n * summary.costPerImageUsd).toFixed(2)})` : ''}</option>)}</select>
              </label>
              {summary.supportsReference && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Basarse en una imagen (opcional)</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => setReferenceId('')} className={`h-11 rounded-lg border px-2 text-[11px] ${!referenceId ? 'border-primary-500 text-primary-700' : 'border-gray-200 text-gray-500'}`}>Ninguna</button>
                    {images.map((m) => (
                      <button key={m.id} onClick={() => setReferenceId(m.id)} className={`h-11 w-11 overflow-hidden rounded-lg ring-2 ${referenceId === m.id ? 'ring-primary-500' : 'ring-transparent'}`}><img src={m.originalUrl || m.url} alt="" className="h-full w-full object-cover" /></button>
                    ))}
                  </div>
                  {!images.length && <p className="text-[11px] text-gray-500">Sube a la publicación la imagen que quieras usar como referencia.</p>}
                </div>
              )}
            </div>
            <button onClick={generate} disabled={busy === 'generate' || prompt.trim().length < 10} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy === 'generate' ? <><Loader2 size={15} className="animate-spin" /> Generando (puede tardar ~30 s)…</> : <><Wand2 size={15} /> Generar</>}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {results.map((c) => (
                <div key={c.id} className="group overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  <div className="relative">
                    <img src={c.previewUrl} alt={c.alt || ''} loading="lazy" className={`w-full object-cover ${orientation === 'portrait' ? 'aspect-[4/5]' : orientation === 'square' ? 'aspect-square' : 'aspect-video'}`} />
                    {brand && kit?.logoUrl && <img src={kit.logoUrl} alt="" className="absolute bottom-2 right-2 h-6 w-auto opacity-90" />}
                  </div>
                  <div className="flex items-center gap-2 p-2">
                    {c.creditUrl ? (
                      <a href={c.creditUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-[10px] text-gray-500 hover:underline inline-flex items-center gap-0.5">{c.credit} <ExternalLink size={9} /></a>
                    ) : <span className="flex-1 truncate text-[10px] text-gray-500">{c.credit}</span>}
                    <button onClick={() => use(c)} disabled={Boolean(busy)} className="shrink-0 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">{busy === c.id ? <Loader2 size={12} className="animate-spin" /> : 'Usar'}</button>
                  </div>
                </div>
              ))}
            </div>
            {tab === 'pexels' && <button onClick={() => search(query, page + 1)} disabled={busy === 'search'} className="text-sm text-primary-700 hover:underline">Más resultados</button>}
            {tab === 'pexels' && <p className="text-[11px] text-gray-500">Fotos de <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline">Pexels</a>: uso comercial gratis. El crédito del fotógrafo se guarda con la imagen.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
