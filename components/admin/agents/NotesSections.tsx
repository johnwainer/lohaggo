'use client'

import { useState } from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { NOTE_STATUS, PRIORITY, TOPIC_LABEL, ageLabel, shortName, type AgentsData, type NoteRow } from './shared'
import { btnGhost, card, fmtWhen, nf, seoApi } from '../seo/shared'

export function FlowsSection({ data }: { data: AgentsData }) {
  const { agents, bus } = data
  const flows = [...bus.flows7d].sort((a, b) => b.count - a.count)
  const open = [...bus.open].sort((a, b) => (a._min.createdAt ?? '').localeCompare(b._min.createdAt ?? ''))
  const openByTo = new Map<string, { n: number; high: number; oldest: string | null }>()
  for (const o of open) {
    const k = o.toAgent ?? ''
    const cur = openByTo.get(k) ?? { n: 0, high: 0, oldest: null }
    cur.n += o._count._all
    if (o.priority === 'high') cur.high += o._count._all
    const c = o._min.createdAt
    if (c && (!cur.oldest || c < cur.oldest)) cur.oldest = c
    openByTo.set(k, cur)
  }
  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-gray-900">Cómo hablan entre sí</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Notas de los últimos 7 días</h3>
          {flows.length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no se han dejado notas.</p> : (
            <ul className="mt-2 divide-y divide-gray-100">
              {flows.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words text-gray-800">{shortName(f.from, agents)} → {shortName(f.to, agents)}</span>
                  <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">{nf(f.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Notas abiertas por destinatario</h3>
          {openByTo.size === 0 ? <p className="mt-2 text-sm text-gray-500">No hay notas abiertas.</p> : (
            <ul className="mt-2 divide-y divide-gray-100">
              {Array.from(openByTo.entries()).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words text-gray-800">
                    {shortName(k || null, agents)}
                    <span className="block text-xs text-gray-500">La más antigua: {ageLabel(v.oldest)}{v.high ? ` · ${v.high} de prioridad alta` : ''}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">{nf(v.n)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function NoteItem({ note, agents, canEdit, onChanged }: { note: NoteRow; agents: AgentsData['agents']; canEdit: boolean; onChanged: () => void }) {
  const [openBody, setOpenBody] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const st = NOTE_STATUS[note.status ?? 'open'] ?? NOTE_STATUS.open
  const pr = PRIORITY[note.priority] ?? PRIORITY.normal
  const readBy = (note.readBy ?? []).map((k) => shortName(k, agents))

  async function act(action: 'resolve' | 'expire') {
    setBusy(action); setErr(null)
    try {
      await seoApi(`/api/admin/agents/notes/${note.id}`, { json: { action } })
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo completar')
    } finally { setBusy(null) }
  }

  return (
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700">{TOPIC_LABEL[note.topic] ?? note.topic}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${pr.cls}`}>{pr.label}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-gray-900">{note.title}</p>
      <p className="mt-0.5 break-words text-xs text-gray-500">
        {shortName(note.fromAgent, agents)} → {shortName(note.toAgent, agents)} · {fmtWhen(note.createdAt)}
      </p>
      {note.body && (
        <>
          <p className={`mt-2 whitespace-pre-wrap break-words text-sm text-gray-700 ${openBody ? '' : 'line-clamp-2'}`}>{note.body}</p>
          <button type="button" onClick={() => setOpenBody((v) => !v)} aria-expanded={openBody} className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-primary-700 sm:min-h-[32px]">
            {openBody ? 'Ver menos' : 'Ver todo'} <ChevronDown size={14} className={openBody ? 'rotate-180' : ''} />
          </button>
        </>
      )}
      <p className="mt-1 break-words text-xs text-gray-500">
        {readBy.length ? `Leída por: ${readBy.join(', ')}` : 'Nadie la ha leído aún'}
        {note.resolvedBy ? ` · Cerrada por: ${note.resolvedBy === 'admin' ? 'una persona' : shortName(note.resolvedBy, agents)}` : ''}
      </p>
      {canEdit && note.status === 'open' && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy !== null} onClick={() => act('resolve')} className={btnGhost}>
            {busy === 'resolve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Marcar atendida
          </button>
          <button type="button" disabled={busy !== null} onClick={() => act('expire')} className={btnGhost}>
            {busy === 'expire' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Descartar
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-xs text-rose-700">{err}</p>}
    </li>
  )
}

export function RecentNotes({ data, onChanged }: { data: AgentsData; onChanged: () => void }) {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-gray-900">Últimas notas</h2>
      {data.bus.recent.length === 0 ? <p className="mt-2 text-sm text-gray-500">Todavía no hay notas.</p> : (
        <ul className="mt-3 space-y-2">
          {data.bus.recent.map((n) => <NoteItem key={n.id} note={n} agents={data.agents} canEdit={data.canEdit} onChanged={onChanged} />)}
        </ul>
      )}
    </section>
  )
}
