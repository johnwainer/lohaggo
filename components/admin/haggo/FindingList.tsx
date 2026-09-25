'use client'

import { useState } from 'react'
import { Check, ChevronDown, EyeOff, RotateCcw } from 'lucide-react'
import { ago, api, domainLabel, SeverityBadge, type Finding } from '@/components/admin/haggo/shared'

/** Findings with their evidence; the superadmin marks them seen, resolved or dismissed. */
export function FindingList({ findings, onChange, empty = 'Nada abierto: todo en orden.' }: { findings: Finding[]; onChange: () => void; empty?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function set(id: string, status: string) {
    setBusy(id)
    try {
      await api(`/api/admin/haggo/findings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      onChange()
    } finally {
      setBusy(null)
    }
  }

  if (!findings.length) return <p className="py-6 text-center text-sm text-gray-500">{empty}</p>
  return (
    <ul className="divide-y divide-gray-100">
      {findings.map((f) => {
        const expanded = open === f.id
        const closed = f.status === 'resolved' || f.status === 'dismissed'
        return (
          <li key={f.id} className="py-3">
            <button onClick={() => setOpen(expanded ? null : f.id)} className="flex w-full items-start gap-3 text-left">
              <SeverityBadge severity={f.severity} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${f.status === 'new' ? 'text-gray-900' : 'text-gray-600'}`}>{f.title}</span>
                <span className="block text-xs text-gray-500">
                  {domainLabel(f.domain)} · {f.occurrences > 1 ? `visto ${f.occurrences} veces, ` : ''}último {ago(f.lastSeenAt)}{f.status === 'new' ? ' · nuevo' : ''}{closed ? ` · ${f.status === 'resolved' ? 'resuelto' : 'descartado'}` : ''}
                </span>
              </span>
              <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
              <div className="mt-2 space-y-3 pl-[4.5rem]">
                {f.body && <p className="whitespace-pre-line text-sm text-gray-700">{f.body}</p>}
                <div className="flex flex-wrap gap-2">
                  {!closed ? (
                    <>
                      {f.status === 'new' && <button disabled={busy === f.id} onClick={() => set(f.id, 'seen')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"><Check size={13} /> Visto</button>}
                      <button disabled={busy === f.id} onClick={() => set(f.id, 'resolved')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"><Check size={13} /> Resuelto</button>
                      <button disabled={busy === f.id} onClick={() => set(f.id, 'dismissed')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"><EyeOff size={13} /> Descartar</button>
                    </>
                  ) : (
                    <button disabled={busy === f.id} onClick={() => set(f.id, 'new')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"><RotateCcw size={13} /> Reabrir</button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">Si la situación sigue, Haggo la vuelve a marcar en el próximo ciclo.</p>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
