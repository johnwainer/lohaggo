'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, BookOpen, CheckCircle2, FileText, Link2, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react'

type Doc = {
  id: string
  title: string
  kind: string
  sourceUrl: string | null
  status: string
  error: string | null
  chunkCount: number
  embeddingModel: string | null
  indexedAt: string | null
  agentIds: string[]
  createdAt: string
}
type Gap = { id: string; question: string; createdAt: string; conversationId: string | null }

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700' },
  indexing: { label: 'Indexando…', cls: 'bg-blue-50 text-blue-700' },
  indexed: { label: 'Indexado', cls: 'bg-emerald-50 text-emerald-700' },
  error: { label: 'Error', cls: 'bg-red-50 text-red-700' },
}
const KIND: Record<string, string> = { text: 'Texto', file: 'Archivo', gdoc: 'Google' }

export default function KnowledgeTab({ workspaceId, agentId, agentName }: { workspaceId: string; agentId: string; agentName: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [gaps, setGaps] = useState<Gap[]>([])
  const [meta, setMeta] = useState<{ pending: number; stale: number; mode: string; embeddingModel: string; canEdit: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<'text' | 'file' | 'gdoc' | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [onlyThis, setOnlyThis] = useState(false)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/ai/knowledge?workspaceId=${workspaceId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Error'); return }
    setDocs(data.docs || [])
    setGaps(data.gaps || [])
    setMeta({ pending: data.pending, stale: data.stale, mode: data.mode, embeddingModel: data.embeddingModel, canEdit: data.canEdit })
  }, [workspaceId])

  useEffect(() => { load() }, [load])
  // Poll while something is being indexed
  useEffect(() => {
    if (!meta?.pending) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [meta?.pending, load])

  const visibleDocs = docs.filter((d) => d.agentIds.length === 0 || d.agentIds.includes(agentId))

  async function request(path: string, init: RequestInit) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, init)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error')
      await load()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const agentIds = onlyThis ? [agentId] : []
    let ok = false
    if (adding === 'file') {
      const file = fileRef.current?.files?.[0]
      if (!file) { setError('Elige un archivo'); return }
      const form = new FormData()
      form.set('workspaceId', workspaceId)
      form.set('file', file)
      form.set('title', title)
      form.set('agentIds', JSON.stringify(agentIds))
      ok = await request('/api/admin/ai/knowledge', { method: 'POST', body: form })
    } else {
      ok = await request('/api/admin/ai/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, kind: adding, title, content, url, agentIds }),
      })
    }
    if (ok) { setAdding(null); setTitle(''); setContent(''); setUrl(''); setOnlyThis(false) }
  }

  async function answerGap(id: string) {
    const ok = await request(`/api/admin/ai/gaps/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'answer', answer }) })
    if (ok) { setAnswering(null); setAnswer('') }
  }

  const canEdit = meta?.canEdit

  return (
    <div className="space-y-6">
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-600 space-y-0.5">
          <p>
            Modo: {meta?.mode === 'semantic' ? <strong>semántico ({meta.embeddingModel})</strong> : <strong className="text-amber-700">léxico (sin clave de Voyage: búsqueda por palabras)</strong>}
          </p>
          {!!meta?.pending && <p className="text-amber-700">{meta.pending} documento(s) pendiente(s) de indexar…</p>}
          {!!meta?.stale && <p className="text-amber-700">{meta.stale} documento(s) indexados con otro modelo de embeddings: reindexa.</p>}
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => request('/api/admin/ai/knowledge', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId }) })} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={14} /> Reindexar todo
            </button>
            <button onClick={() => setAdding('text')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"><FileText size={14} /> Texto</button>
            <button onClick={() => setAdding('file')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"><Upload size={14} /> Archivo</button>
            <button onClick={() => setAdding('gdoc')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"><Link2 size={14} /> Google Docs</button>
          </div>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">{adding === 'text' ? 'Nuevo texto' : adding === 'file' ? 'Subir archivo (txt, md, csv, pdf)' : 'Enlace de Google Docs, Sheets o Slides'}</p>
            <button onClick={() => setAdding(null)}><X size={16} /></button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (lo verá el agente junto al fragmento)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
          {adding === 'text' && <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Precios, horarios, políticas, preguntas frecuentes…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />}
          {adding === 'file' && <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,text/plain,text/markdown,text/csv,application/pdf" className="text-sm" />}
          {adding === 'gdoc' && (
            <>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
              <p className="text-xs text-gray-500">Compártelo como «Cualquier persona con el enlace». Se relee cada vez que pulsas reindexar.</p>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={onlyThis} onChange={(e) => setOnlyThis(e.target.checked)} /> Solo para {agentName} (si no, lo usan todos los agentes del workspace)</label>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Guardar e indexar
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {visibleDocs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500"><BookOpen className="mx-auto mb-2 text-gray-300" size={32} />Sin documentos. Sin conocimiento, el agente traspasará todo lo que no pueda responder por sí mismo.</div>
        ) : visibleDocs.map((d) => (
          <div key={d.id} className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 truncate">{d.title}</p>
                <span className="text-[11px] rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">{KIND[d.kind] || d.kind}</span>
                <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS[d.status]?.cls || ''}`}>{STATUS[d.status]?.label || d.status}</span>
                {d.agentIds.length > 0 && <span className="text-[11px] rounded-full bg-primary-50 text-primary-700 px-2 py-0.5">Solo este agente</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {d.chunkCount} fragmento(s){d.embeddingModel ? ` · ${d.embeddingModel}` : ' · léxico'}{d.indexedAt ? ` · ${new Date(d.indexedAt).toLocaleString('es-CO')}` : ''}
                {d.sourceUrl ? <> · <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">abrir</a></> : null}
              </p>
              {d.error && <p className="text-xs text-red-600 mt-1">{d.error}</p>}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <button title="Reindexar" onClick={() => request(`/api/admin/ai/knowledge/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw size={15} /></button>
                <button title="Eliminar" onClick={() => window.confirm(`¿Eliminar "${d.title}"?`) && request(`/api/admin/ai/knowledge/${d.id}`, { method: 'DELETE' })} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Huecos de conocimiento</h3>
        <p className="text-xs text-gray-500">Preguntas que un agente no supo responder y traspasó. Responder una crea un documento y la cierra: así la base mejora con el uso.</p>
        {gaps.length === 0 ? <p className="text-sm text-gray-400">Sin huecos abiertos.</p> : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {gaps.map((g) => (
              <div key={g.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-900">“{g.question}”</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(g.createdAt).toLocaleDateString('es-CO')}</span>
                </div>
                {canEdit && (answering === g.id ? (
                  <div className="space-y-2">
                    <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="La respuesta correcta que el agente debe dar" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => answerGap(g.id)} disabled={busy || !answer.trim()} className="px-3 py-1.5 rounded-xl bg-primary-600 text-white text-sm disabled:opacity-50">Guardar en el conocimiento</button>
                      <button onClick={() => setAnswering(null)} className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => { setAnswering(g.id); setAnswer('') }} className="text-primary-600 hover:underline">Responder</button>
                    <button onClick={() => request(`/api/admin/ai/gaps/${g.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dismiss' }) })} className="text-gray-500 hover:underline">Descartar</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
