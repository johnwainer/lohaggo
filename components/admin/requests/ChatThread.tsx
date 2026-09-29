'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Loader2, Send, ShieldAlert } from 'lucide-react'
import type { CaseProposal, Recipient } from './types'
import { btn, input, when } from './ui'

const SUPPORT_MAX = 1000

export type ChatThreadHandle = { focusWith: (to: Recipient) => void }

type Blocked = { side: string | null; reason: string | null; text: string | null; at: string }

function parseBlocked(entries: NonNullable<CaseProposal['chat']>['blocked']): Blocked[] {
  return entries.map((e) => {
    let d: Record<string, unknown> = {}
    try { d = typeof e.details === 'string' ? JSON.parse(e.details) : {} } catch { d = {} }
    const s = (v: unknown) => (typeof v === 'string' ? v : null)
    return { side: s(d.side), reason: s(d.reason), text: s(d.text), at: e.at }
  })
}

const RECIPIENTS: Array<{ id: Recipient; label: string }> = [
  { id: 'client', label: 'Cliente' },
  { id: 'partner', label: 'Socio' },
  { id: 'both', label: 'Ambos' },
]

export const ChatThread = forwardRef<ChatThreadHandle, {
  proposal: CaseProposal
  clientName: string | null
  onOpenImage: (urls: string[], index: number) => void
  onSend: (text: string, to: Recipient) => Promise<boolean>
}>(function ChatThread({ proposal, clientName, onOpenImage, onSend }, ref) {
  const [to, setTo] = useState<Recipient>('both')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const messages = proposal.chat?.messages ?? []
  const blocked = parseBlocked(proposal.chat?.blocked ?? [])

  useImperativeHandle(ref, () => ({
    focusWith: (r) => {
      setTo(r)
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => areaRef.current?.focus({ preventScroll: true }), 350)
    },
  }))

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const send = async () => {
    const t = text.trim()
    if (t.length < 2) return
    setSending(true)
    const ok = await onSend(t, to)
    setSending(false)
    if (ok) setText('')
  }

  const images = messages.filter((m) => m.imageUrl).map((m) => m.imageUrl as string)

  return (
    <div ref={rootRef} className="min-w-0 space-y-3">
      {blocked.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-red-800"><ShieldAlert className="h-4 w-4" /> Intentos bloqueados ({blocked.length})</p>
          <ul className="mt-2 space-y-2">
            {blocked.map((b, i) => (
              <li key={i} className="rounded-xl bg-white/70 p-2 text-sm text-red-900">
                <p className="text-xs font-semibold text-red-700">
                  {b.side === 'CLIENT' ? `Cliente${clientName ? ` (${clientName})` : ''}` : b.side === 'PARTNER' ? `Socio (${proposal.partner.name ?? '—'})` : 'Desconocido'} · {when(b.at)}{b.reason ? ` · ${b.reason}` : ''}
                </p>
                {b.text && <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs">{b.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={listRef} className="max-h-[60dvh] space-y-2 overflow-y-auto rounded-2xl bg-gray-50 p-3">
        {!messages.length && <p className="py-6 text-center text-sm text-gray-400">Sin mensajes en este chat.</p>}
        {messages.map((m) => {
          const img = m.imageUrl ? (
            <button type="button" onClick={() => onOpenImage(images, images.indexOf(m.imageUrl as string))} className="mt-1 block h-32 w-32 overflow-hidden rounded-xl border border-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.imageUrl} alt="Imagen del chat" className="h-full w-full object-cover" />
            </button>
          ) : null
          if (m.side === 'SYSTEM' || m.side === 'SUPPORT') {
            const support = m.side === 'SUPPORT'
            return (
              <div key={m.id} className="flex justify-center">
                <div className={`max-w-[92%] rounded-2xl border px-3 py-2 text-center text-xs sm:max-w-[80%] ${support ? 'border-violet-200 bg-violet-50 text-violet-900' : 'border-gray-200 bg-white text-gray-600'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  {img}
                  <p className="mt-1 text-[10px] opacity-70">{support ? 'Soporte' : 'Sistema'} · {when(m.at)}</p>
                </div>
              </div>
            )
          }
          const client = m.side === 'CLIENT'
          return (
            <div key={m.id} className={`flex ${client ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[70%] ${client ? 'rounded-bl-md bg-white text-gray-900 shadow-sm' : 'rounded-br-md bg-primary-500 text-white'}`}>
                <p className={`text-[11px] font-semibold ${client ? 'text-primary-600' : 'text-white/80'}`}>{client ? clientName ?? 'Cliente' : proposal.partner.name ?? 'Socio'}</p>
                {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                {img}
                <p className={`mt-1 text-right text-[10px] ${client ? 'text-gray-400' : 'text-white/70'}`}>{when(m.at)}{m.origin && m.origin !== 'app' ? ` · ${m.origin}` : ''}{m.read ? ' · leído' : ''}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2 rounded-2xl border border-gray-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Escribir como Soporte a</span>
          <div className="flex rounded-full bg-gray-100 p-0.5">
            {RECIPIENTS.map((r) => (
              <button key={r.id} type="button" onClick={() => setTo(r.id)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${to === r.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <textarea ref={areaRef} value={text} onChange={(e) => setText(e.target.value.slice(0, SUPPORT_MAX))} rows={3} placeholder="Mensaje de Soporte LoHaggo (llega en la app y por WhatsApp)" className={input} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">{text.length}/{SUPPORT_MAX}</span>
          <button type="button" disabled={sending || text.trim().length < 2} onClick={send} className={btn.primary}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
          </button>
        </div>
      </div>
    </div>
  )
})
