'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Brain, Check, Lightbulb, Loader2, Search, Send, Sparkles, X } from 'lucide-react'
import { api, card, usd, when } from '@/components/admin/haggo/shared'

type Proposal = { id: string; text: string; rule: unknown; status: 'pending' | 'saved' | 'discarded'; directiveId?: string }
type RunOut = { tools: string[]; proposals: Proposal[]; recommendations: string[]; remembered: string[] }
type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; run: { id: string; costUsd: number; status: string; model: string | null; output: RunOut | null } | null }

const TOOL_LABEL: Record<string, string> = {
  tendencias_negocio: 'negocio', salud_sistema: 'salud del sistema', conversaciones_en_espera: 'bandeja', agente_ia: 'agente IA', marketing: 'marketing',
  solicitudes_sin_propuestas: 'solicitudes', costos_ia: 'costos de IA', hallazgos_abiertos: 'hallazgos', incidentes_abiertos: 'incidentes', dinero: 'dinero',
  oferta_y_demanda: 'oferta y demanda', busquedas: 'búsquedas', personas_y_adquisicion: 'adquisición', atencion: 'atención', resenas: 'reseñas', socios: 'socios',
  mensajeria: 'mensajería', seguridad: 'seguridad', agentes_marketing: 'agentes de marketing', publicidad: 'publicidad',
}
const SUGGESTIONS = ['¿Cómo va el negocio esta semana?', '¿Por qué hay solicitudes sin propuestas?', '¿Qué está fallando en el sistema?', '¿Cuánto gastamos en IA este mes y en qué?']

/** **bold** and [text](/admin…) inside a line; everything else is plain text (no HTML from the model). */
function inline(text: string) {
  const out: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/admin[^)\s]*)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>)
    else out.push(<Link key={m.index} href={m[3]} className="font-medium text-primary-600 underline-offset-2 hover:underline">{m[2]}</Link>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Paragraphs and "- " / "1. " lists. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim())
        if (lines.length && lines.every((l) => /^\s*([-•*]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0])
          const items = lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-•*]|\d+\.)\s+/, ''))}</li>)
          return ordered ? <ol key={i} className="list-decimal space-y-1 pl-5">{items}</ol> : <ul key={i} className="list-disc space-y-1 pl-5">{items}</ul>
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>
      })}
    </div>
  )
}

function ProposalCard({ runId, p, onDone }: { runId: string; p: Proposal; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState(p.text)
  const [error, setError] = useState<string | null>(null)
  async function decide(decision: 'save' | 'discard') {
    setBusy(true)
    setError(null)
    try {
      await api('/api/admin/haggo/chat/proposals', { method: 'POST', body: JSON.stringify({ runId, proposalId: p.id, decision, text }) })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2 rounded-xl border border-primary-200 bg-primary-50/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-700"><Lightbulb size={13} /> Directiva propuesta {p.status === 'pending' ? '(no está activa hasta que la guardes)' : p.status === 'saved' ? '· guardada y activa' : '· descartada'}</p>
      {p.status === 'pending' ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-sm" />
          <div className="mt-2 flex gap-2">
            <button disabled={busy} onClick={() => decide('save')} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"><Check size={13} /> Guardar directiva</button>
            <button disabled={busy} onClick={() => decide('discard')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"><X size={13} /> Descartar</button>
          </div>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </>
      ) : <p className={`mt-1 text-sm ${p.status === 'discarded' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{p.text}</p>}
    </div>
  )
}

/** Talk to Haggo: questions answered with real numbers, rules that become directives once confirmed. */
export function ChatTab() {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const r = await api<{ messages: Message[] }>('/api/admin/haggo/chat')
    setMessages(r.messages)
  }, [])
  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, sending])

  async function send(value = text) {
    const v = value.trim()
    if (!v || sending) return
    setSending(true)
    setError(null)
    setText('')
    setMessages((m) => [...(m ?? []), { id: `tmp-${Date.now()}`, role: 'user', content: v, createdAt: new Date().toISOString(), run: null }])
    try {
      await api('/api/admin/haggo/chat', { method: 'POST', body: JSON.stringify({ text: v }) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setText(v)
    } finally {
      await load().catch(() => null)
      setSending(false)
    }
  }

  if (!messages) return <div className="flex items-center gap-2 p-6 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  return (
    <section className={`${card} flex h-[calc(100dvh-16rem)] min-h-[28rem] flex-col`}>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-orange-400 text-white"><Sparkles size={22} /></span>
            <p className="mt-3 font-semibold text-gray-900">Pregúntame lo que quieras de la plataforma</p>
            <p className="text-sm text-gray-500">Respondo con datos reales. Si me dices una regla, te propongo guardarla como directiva.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] sm:max-w-[80%] ${m.role === 'user' ? 'rounded-2xl rounded-br-md bg-gray-900 px-4 py-2.5 text-white' : 'w-full'}`}>
              {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : (
                <div className="rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3">
                  {!!m.run?.output?.tools.length && <p className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-gray-500"><Search size={11} /> Consultó: {m.run.output.tools.map((t) => TOOL_LABEL[t] ?? t).join(', ')}</p>}
                  <div className={m.run?.status === 'error' ? 'text-rose-700' : 'text-gray-800'}><Rich text={m.content} /></div>
                  {m.run?.output?.proposals.map((p) => <ProposalCard key={p.id} runId={m.run!.id} p={p} onDone={load} />)}
                  {!!m.run?.output?.recommendations.length && <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><Lightbulb size={12} /> Dejé {m.run.output.recommendations.length === 1 ? 'una recomendación' : `${m.run.output.recommendations.length} recomendaciones`} en <a href="/admin/haggo?tab=analysis" className="underline">Análisis</a>.</p>}
                  {!!m.run?.output?.remembered.length && <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Brain size={12} /> Guardé en mi memoria: «{m.run.output.remembered.join('» · «')}»</p>}
                  <p className="mt-2 text-[11px] text-gray-400">{when(m.createdAt)}{m.run?.costUsd ? ` · ${usd(m.run.costUsd)}` : ''}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Haggo está investigando…</div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-100 p-3 sm:p-4">
        {messages.length === 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} disabled={sending} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">{s}</button>)}
          </div>
        )}
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
            rows={Math.min(6, Math.max(1, text.split('\n').length))}
            maxLength={4000}
            placeholder="Escríbele a Haggo…"
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-400 focus:outline-none"
          />
          <button onClick={() => send()} disabled={sending || !text.trim()} className="rounded-full bg-primary-600 p-3 text-white hover:bg-primary-700 disabled:opacity-40" title="Enviar"><Send size={16} /></button>
        </div>
        <p className="mt-1.5 hidden text-[11px] text-gray-400 sm:block">Enter para enviar · Shift+Enter para salto de línea</p>
      </div>
    </section>
  )
}
