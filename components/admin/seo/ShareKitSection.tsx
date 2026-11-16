'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { btnGhost, btnPrimary, card, fmtWhen, seoApi } from './shared'

type Kit = { url: string; whatsapp: string; facebook: string; instagram: string; hashtags: string[] }
type Article = { slug: string; title: string; category: string | null; publishedAt: string | null; kit: Kit }
type Channel = 'whatsapp' | 'facebook' | 'instagram'

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
]

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function ShareKitSection() {
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ key: string; ok: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await seoApi<{ articles: Article[] }>('/api/admin/seo/share')
      setArticles(data.articles ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
      setArticles([])
    }
  }, [])

  useEffect(() => { void load(); return () => { if (timer.current) clearTimeout(timer.current) } }, [load])

  const copy = async (key: string, text: string) => {
    const ok = await copyText(text)
    setNotice({ key, ok })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNotice(null), 2500)
  }

  return (
    <section className={card}>
      <h2 className="text-base font-semibold text-gray-900">Compartir artículos</h2>
      <p className="mt-1 text-sm text-gray-500">Textos listos con las palabras del artículo y un enlace con seguimiento. Cópialos y pégalos en el canal.</p>

      {articles === null && <p className="mt-4 text-sm text-gray-500">Cargando…</p>}
      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      {articles?.length === 0 && !error && <p className="mt-4 text-sm text-gray-500">Aún no hay artículos publicados para compartir.</p>}

      <ul className="mt-4 space-y-3">
        {articles?.map((a) => (
          <li key={a.slug} className="min-w-0 rounded-2xl border border-gray-200 p-3">
            <p className="break-words text-sm font-semibold text-gray-900">{a.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{[a.category, a.publishedAt ? fmtWhen(a.publishedAt) : null].filter(Boolean).join(' · ')}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CHANNELS.map((c) => {
                const key = `${a.slug}:${c.key}`
                const state = notice?.key === key ? notice : null
                return (
                  <button key={c.key} type="button" className={`${btnGhost} w-full`} onClick={() => copy(key, a.kit[c.key])}>
                    {state ? (state.ok ? 'Copiado' : 'No se pudo copiar') : `Copiar para ${c.label}`}
                  </button>
                )
              })}
            </div>
            <a
              className={`${btnPrimary} mt-2 w-full sm:w-auto`}
              href={`https://wa.me/?text=${encodeURIComponent(a.kit.whatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir en WhatsApp
            </a>
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status" aria-live="polite">{notice ? (notice.ok ? 'Copiado' : 'No se pudo copiar') : ''}</span>
    </section>
  )
}

export default ShareKitSection
