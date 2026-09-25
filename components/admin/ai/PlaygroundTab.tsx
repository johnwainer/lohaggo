'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, RotateCcw, Send, Wrench } from 'lucide-react'
import { CHANNEL_LABEL, usd } from '@/components/admin/ai/shared'

type Turn = { role: 'user' | 'assistant'; content: string }
type ToolCall = { name: string; input: Record<string, unknown>; output: string; dryRun: boolean; isError: boolean }
type Chunk = { title: string; text: string; score: number }
type Result = {
  ok: boolean
  text: string
  handoff: boolean
  handoffReason: string | null
  handoffDetail?: string | null
  done?: boolean
  spam?: boolean
  toolsUsed: ToolCall[]
  chunks: Chunk[]
  knowledgeMode?: string
  model: string | null
  provider?: 'anthropic' | 'openai' | null
  requestedModel?: string
  costUsd: number
  rounds?: number
  stopReason?: string | null
  error?: string | null
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } | null
  preHandoff?: { action: string; reason?: string } | null
}

const REASON: Record<string, string> = {
  model: 'no supo responder', tool: 'pidió pasar a una persona', refusal: 'el modelo declinó', keyword: 'palabra clave', max_turns: 'tope de turnos',
  outside_hours: 'fuera de horario', budget: 'tope mensual', api_error: 'error del proveedor', tool_loop: 'demasiadas vueltas', empty: 'respuesta vacía', goal_done: 'objetivo cumplido',
}

export default function PlaygroundTab({ agentId, canTest, dirty }: { agentId: string; canTest: boolean; dirty: boolean }) {
  const [channel, setChannel] = useState('WHATSAPP')
  const [turns, setTurns] = useState<Array<Turn & { result?: Result }>>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns.length])

  const total = turns.reduce((acc, t) => acc + (t.result?.costUsd || 0), 0)

  async function send() {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    setError(null)
    const history = turns.map(({ role, content }) => ({ role, content }))
    setTurns((t) => [...t, { role: 'user', content: msg }])
    setText('')
    try {
      const res = await fetch(`/api/admin/ai/agents/${agentId}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: msg, history, channel }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error')
      const result: Result = data.result
      setTurns((t) => {
        const next = [...t, { role: 'assistant' as const, content: result.spam ? '(sin respuesta: marcado como publicidad)' : result.text || '(sin respuesta)', result }]
        setSelected(next.length - 1)
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSending(false)
    }
  }

  const detail = selected != null ? turns[selected]?.result : undefined

  if (!canTest) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Probar consume saldo: necesitas el permiso «Probar agentes».</div>
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-[560px]">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Como si fuera</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
              {Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Coste: {usd(total)}</span>
            <button onClick={() => { setTurns([]); setSelected(null) }} className="inline-flex items-center gap-1 hover:text-gray-800"><RotateCcw size={13} /> Reiniciar</button>
          </div>
        </div>
        {dirty && <p className="px-4 py-2 text-xs bg-amber-50 text-amber-800">Hay cambios sin guardar: las pruebas usan la configuración guardada.</p>}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {turns.length === 0 && <p className="text-center text-sm text-gray-400 mt-20">Escribe como lo haría un cliente. Es el mismo agente que responde en producción; las herramientas que escriben corren en seco.</p>}
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <button
                onClick={() => t.result && setSelected(i)}
                className={`max-w-[80%] text-left whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${t.role === 'user' ? 'bg-primary-600 text-white' : `bg-white border ${selected === i ? 'border-primary-400' : 'border-gray-200'} text-gray-900`}`}
              >
                {t.content}
                {t.result && (
                  <span className="block mt-1 text-[10px] text-gray-400">
                    {t.result.model || 'sin modelo'}{t.result.provider === 'openai' ? ' (OpenAI)' : ''} · {usd(t.result.costUsd)}
                    {t.result.handoff ? ` · traspaso (${REASON[t.result.handoffReason || ''] || t.result.handoffReason})` : ''}
                    {t.result.done ? ' · objetivo cumplido' : ''}
                  </span>
                )}
              </button>
            </div>
          ))}
          {sending && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={14} className="animate-spin" /> Pensando…</div>}
          <div ref={endRef} />
        </div>
        {error && <div className="flex items-center gap-2 px-4 py-2 text-sm text-red-700 bg-red-50"><AlertCircle size={14} /> {error}</div>}
        <div className="flex gap-2 p-3 border-t border-gray-100">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Mensaje de prueba…" className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm" />
          <button onClick={send} disabled={sending || !text.trim()} className="rounded-full bg-primary-600 text-white p-2.5 disabled:opacity-50"><Send size={16} /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4 text-sm h-[560px] overflow-y-auto">
        <h3 className="font-semibold text-gray-900">Detalle del turno</h3>
        {!detail ? <p className="text-gray-400 text-xs">Pulsa una respuesta para ver qué pasó.</p> : (
          <>
            {!detail.ok && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                <strong>La llamada falló:</strong> {detail.error}. En producción se traspasaría con el mensaje de traspaso.
              </div>
            )}
            {detail.preHandoff && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                Decidido antes de llamar al modelo: {detail.preHandoff.action === 'handoff' ? `traspaso por ${REASON[detail.preHandoff.reason || ''] || detail.preHandoff.reason}` : detail.preHandoff.action === 'notice' ? 'aviso de fuera de horario' : 'silencio fuera de horario'}. Sin coste.
              </div>
            )}
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-gray-500">Modelo que respondió</dt><dd className="font-mono">{detail.model || '—'}{detail.provider ? ` · ${detail.provider === 'openai' ? 'OpenAI' : 'Claude'}` : ''}</dd>
              {detail.provider === 'openai' && (<><dt className="text-gray-500">Proveedor</dt><dd className="text-amber-700">OpenAI respondió porque Claude no estaba disponible (o OpenAI es el principal)</dd></>)}
              {detail.provider !== 'openai' && detail.requestedModel && detail.model && detail.requestedModel !== detail.model && (<><dt className="text-gray-500">Pedido</dt><dd className="font-mono text-amber-700">{detail.requestedModel} (reserva)</dd></>)}
              <dt className="text-gray-500">Vueltas</dt><dd>{detail.rounds ?? 0}</dd>
              <dt className="text-gray-500">Motivo de parada</dt><dd>{detail.stopReason || '—'}</dd>
              <dt className="text-gray-500">Coste</dt><dd>{usd(detail.costUsd)}</dd>
              {detail.usage && (<>
                <dt className="text-gray-500">Tokens ent / sal</dt><dd>{detail.usage.inputTokens} / {detail.usage.outputTokens}</dd>
                <dt className="text-gray-500">Caché leída / escrita</dt><dd>{detail.usage.cacheReadTokens} / {detail.usage.cacheWriteTokens}</dd>
              </>)}
              <dt className="text-gray-500">Conocimiento</dt><dd>{detail.knowledgeMode || '—'}</dd>
            </dl>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Wrench size={12} /> Herramientas ({detail.toolsUsed.length})</p>
              {detail.toolsUsed.length === 0 ? <p className="text-xs text-gray-400">Ninguna.</p> : detail.toolsUsed.map((t, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-2 mb-1.5 text-xs">
                  <p className="font-mono font-medium">{t.name}{t.dryRun ? ' · en seco' : ''}{t.isError ? ' · error' : ''}</p>
                  <p className="text-gray-500 break-all">{JSON.stringify(t.input)}</p>
                  <p className="text-gray-700 mt-1 whitespace-pre-wrap">{t.output.slice(0, 400)}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Fragmentos usados ({detail.chunks.length})</p>
              {detail.knowledgeMode === 'full' && <p className="text-xs text-gray-500">Base pequeña: va completa en el prompt (y en caché).</p>}
              {detail.chunks.map((c, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-2 mb-1.5 text-xs">
                  <p className="font-medium">{c.title} <span className="text-gray-400">· {c.score.toFixed(2)}</span></p>
                  <p className="text-gray-600 line-clamp-3">{c.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
