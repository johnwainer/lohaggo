'use client'

import { useState } from 'react'
import { Hash, Lightbulb, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import { CHANNEL_NAME, api, input, type MkChannel } from '@/components/admin/marketing/shared'
import type { Post } from '@/components/admin/marketing/editor/types'

type Result =
  | { kind: 'text'; text: string; action: string }
  | { kind: 'hashtags'; hashtags: string[] }
  | { kind: 'ideas'; ideas: Array<{ title: string; angle?: string; format?: string }> }
  | { kind: 'seo'; seo: { seoTitle: string; seoDescription: string; slug: string; excerpt: string; tags: string[] } }

const QUICK = ['Más corto', 'Más cercano', 'Más formal', 'Con llamada a la acción', 'Más emojis', 'Sin emojis']

/**
 * Writing assistant beside the editor. Drafts, adapts between channels, improves, suggests hashtags,
 * ideas and SEO data. Nothing is applied until the person clicks "Usar".
 */
export default function CopilotPanel({ post, channel, currentText, brief, setBrief, onApplyText, onAppendText, onApplySeo, onUseIdea }: {
  post: Post
  channel: MkChannel
  currentText: string
  brief: string
  setBrief: (v: string) => void
  onApplyText: (text: string) => void
  onAppendText: (text: string) => void
  onApplySeo: (seo: Extract<Result, { kind: 'seo' }>['seo']) => void
  onUseIdea: (idea: { title: string; angle?: string }) => void
}) {
  const [tone, setTone] = useState('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const others = post.variants.filter((v) => v.channel !== channel && v.body.trim())

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setLoading(action)
    setError(null)
    try {
      const d = await api<{ text?: string; hashtags?: string[]; ideas?: Array<{ title: string; angle?: string; format?: string }>; seo?: Extract<Result, { kind: 'seo' }>['seo'] }>('/api/admin/marketing/copilot', {
        method: 'POST',
        json: { workspaceId: post.workspaceId, postId: post.id, action, channel, brief, title: post.title, tone, ...extra },
      })
      if (d.text) setResult({ kind: 'text', text: d.text, action })
      else if (d.hashtags) setResult({ kind: 'hashtags', hashtags: d.hashtags })
      else if (d.ideas) setResult({ kind: 'ideas', ideas: d.ideas })
      else if (d.seo) setResult({ kind: 'seo', seo: d.seo })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(null)
    }
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50'
  const spin = (a: string) => (loading === a ? <Loader2 size={13} className="animate-spin" /> : null)

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900"><Sparkles size={15} /> Asistente de redacción · {CHANNEL_NAME[channel]}</p>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-700">Idea o brief</span>
        <textarea className={input} rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Ej. Recordar que antes de la temporada de lluvias conviene revisar techos y canales; ofrecer técnicos verificados" />
      </label>
      <input className={input} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tono (opcional): cercano, experto, divertido…" />
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} disabled={!!loading} onClick={() => run('draft')}>{spin('draft') || <Wand2 size={13} />} Redactar</button>
        {others.map((o) => (
          <button key={o.channel} className={btn} disabled={!!loading} onClick={() => run('adapt', { text: o.body, sourceChannel: o.channel })}>{spin('adapt') || <RefreshCw size={13} />} Adaptar desde {CHANNEL_NAME[o.channel]}</button>
        ))}
        {channel !== 'WEB' && <button className={btn} disabled={!!loading || !(currentText || brief).trim()} onClick={() => run('hashtags', { text: currentText })}>{spin('hashtags') || <Hash size={13} />} Hashtags</button>}
        {channel === 'WEB' && <button className={btn} disabled={!!loading || !currentText.trim()} onClick={() => run('seo', { text: currentText })}>{spin('seo') || <Sparkles size={13} />} Datos SEO</button>}
        <button className={btn} disabled={!!loading} onClick={() => run('ideas')}>{spin('ideas') || <Lightbulb size={13} />} Ideas</button>
      </div>
      {currentText.trim() && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-700">Mejorar el texto actual</p>
          <div className="flex flex-wrap gap-1">
            {QUICK.map((q) => <button key={q} disabled={!!loading} onClick={() => run('improve', { text: currentText, instruction: q })} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">{q}</button>)}
          </div>
          <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (instruction.trim()) run('improve', { text: currentText, instruction }) }}>
            <input className={`${input} py-1.5 text-xs`} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Otra indicación: menciona Medellín, añade un dato…" />
            <button disabled={!!loading || !instruction.trim()} className="rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{spin('improve') || 'Ir'}</button>
          </form>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && (
        <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2">
          {result.kind === 'text' && (
            <>
              <p className="whitespace-pre-wrap break-words text-sm text-gray-800 max-h-80 overflow-y-auto">{result.text}</p>
              <div className="flex gap-2">
                <button onClick={() => { onApplyText(result.text); setResult(null) }} className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700">{currentText.trim() ? 'Reemplazar texto' : 'Usar'}</button>
                {currentText.trim() && <button onClick={() => { onAppendText(result.text); setResult(null) }} className="rounded-lg border border-violet-200 px-3 py-1 text-xs text-violet-800">Añadir al final</button>}
                <button onClick={() => setResult(null)} className="ml-auto text-xs text-gray-500">Descartar</button>
              </div>
            </>
          )}
          {result.kind === 'hashtags' && (
            <>
              <p className="text-sm text-gray-800 break-words">{result.hashtags.join(' ')}</p>
              <div className="flex gap-2">
                <button onClick={() => { onAppendText(result.hashtags.join(' ')); setResult(null) }} className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white">Añadir al texto</button>
                <button onClick={() => setResult(null)} className="ml-auto text-xs text-gray-500">Descartar</button>
              </div>
            </>
          )}
          {result.kind === 'ideas' && (
            <div className="space-y-1.5">
              {result.ideas.map((idea, i) => (
                <button key={i} onClick={() => { onUseIdea(idea); setResult(null) }} className="block w-full rounded-lg border border-gray-100 px-2.5 py-2 text-left hover:bg-violet-50">
                  <span className="block text-sm font-medium text-gray-900">{idea.title}</span>
                  {idea.angle && <span className="block text-xs text-gray-500">{idea.angle}{idea.format ? ` · ${idea.format}` : ''}</span>}
                </button>
              ))}
              <p className="text-[11px] text-gray-500">Elige una para usarla como título y brief.</p>
            </div>
          )}
          {result.kind === 'seo' && (
            <>
              <dl className="text-xs space-y-1">
                <div><dt className="font-medium text-gray-500">Título SEO</dt><dd className="text-gray-900">{result.seo.seoTitle}</dd></div>
                <div><dt className="font-medium text-gray-500">Meta descripción</dt><dd className="text-gray-900">{result.seo.seoDescription}</dd></div>
                <div><dt className="font-medium text-gray-500">URL</dt><dd className="text-gray-900">/blog/{result.seo.slug}</dd></div>
                <div><dt className="font-medium text-gray-500">Etiquetas</dt><dd className="text-gray-900">{result.seo.tags.join(', ')}</dd></div>
              </dl>
              <div className="flex gap-2">
                <button onClick={() => { onApplySeo(result.seo); setResult(null) }} className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white">Aplicar</button>
                <button onClick={() => setResult(null)} className="ml-auto text-xs text-gray-500">Descartar</button>
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-[11px] text-gray-500">Revisa siempre precios, fechas y promociones: el asistente no los inventa y deja [marcadores] cuando falta un dato.</p>
    </div>
  )
}
