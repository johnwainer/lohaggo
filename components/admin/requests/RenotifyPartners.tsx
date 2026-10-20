'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, Loader2, Star } from 'lucide-react'
import type { PartnerCandidate } from '@/lib/admin/request-partners'
import { Sheet, btn } from '@/components/admin/requests/ui'

type Data = { direct: boolean; open: boolean; candidates: PartnerCandidate[] }

const chip = (ok: boolean) => `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'}`

/**
 * «Volver a avisar a los socios» with a choice: who offers this service here, who can see the request,
 * how they fit and how many times they were told; pick some, several or all and tell them.
 */
export function RenotifyPartnersSheet({ requestId, busy, onSend, onClose }: {
  requestId: string
  busy: boolean
  onSend: (partnerIds: string[]) => Promise<boolean>
  onClose: () => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [onlyAvailable, setOnlyAvailable] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/service-requests/${requestId}/partners`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'No se pudo cargar'); return d as Data })
      .then((d) => {
        if (!alive) return
        setData(d)
        // Suggested: those who can see it and are available
        setPicked(new Set(d.candidates.filter((c) => c.selectable && c.available).map((c) => c.partnerId)))
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'No se pudo cargar'))
    return () => { alive = false }
  }, [requestId])

  const shown = useMemo(() => (data?.candidates ?? []).filter((c) => !onlyAvailable || c.available), [data, onlyAvailable])
  const selectable = shown.filter((c) => c.selectable)
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.partnerId))
  const count = (data?.candidates ?? []).filter((c) => picked.has(c.partnerId)).length

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setPicked((p) => {
    const n = new Set(p)
    if (allPicked) selectable.forEach((c) => n.delete(c.partnerId))
    else selectable.forEach((c) => n.add(c.partnerId))
    return n
  })

  const send = async () => { if (await onSend(Array.from(picked))) onClose() }

  return (
    <Sheet
      title="Volver a avisar a los socios"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={btn.ghost}>Volver</button>
        <button type="button" disabled={busy || !count || !data?.open} className={btn.primary} onClick={send}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
          Avisar a {count} {count === 1 ? 'socio' : 'socios'}
        </button>
      </>}
    >
      {!data && !error && <p className="flex items-center gap-2 text-gray-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando socios…</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-red-800" role="alert">{error}</p>}
      {data && (
        <>
          <p className="text-gray-700">
            {data.direct ? 'Es una solicitud directa: solo la ve el socio elegido por el cliente.' : 'Socios que ofrecen este servicio en la ciudad. Les llega por WhatsApp y en la app; quienes no podrían verla aparecen sin casilla.'}
          </p>
          {!data.open && <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">La solicitud no está activa: reactívala para poder avisar.</p>}
          {data.candidates.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-3 py-3 text-gray-700">Ningún socio ofrece este servicio en esta ciudad.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={toggleAll} disabled={!selectable.length} className="min-h-[36px] rounded-full px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50">
                  {allPicked ? 'Quitar selección' : `Seleccionar todos (${selectable.length})`}
                </button>
                <label className="flex min-h-[36px] items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
                  Solo disponibles
                </label>
              </div>
              <ul className="space-y-2">
                {shown.map((c) => (
                  <li key={c.partnerId}>
                    <label className={`flex gap-3 rounded-2xl border p-3 ${c.selectable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed bg-gray-50 opacity-80'} ${picked.has(c.partnerId) ? 'border-primary-400 bg-primary-50/40' : 'border-gray-200'}`}>
                      <input type="checkbox" className="mt-1" disabled={!c.selectable} checked={picked.has(c.partnerId)} onChange={() => toggle(c.partnerId)} aria-label={`Avisar a ${c.name}`} />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-gray-900">{c.name}</span>
                          {c.totalReviews > 0 && <span className="inline-flex items-center gap-0.5 text-xs text-gray-700"><Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />{c.rating.toFixed(1)} ({c.totalReviews})</span>}
                          {c.completedServices > 0 && <span className="text-xs text-gray-600">{c.completedServices} servicios</span>}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          <span className={chip(c.available)}>{c.available ? 'Disponible' : 'No disponible'}</span>
                          <span className={chip(c.zoneOk)}>{c.zoneOk ? 'Cubre la zona' : 'Otra zona'}</span>
                          <span className={chip(c.scheduleOk)}>{c.scheduleOk ? 'Horario coincide' : 'Horario no coincide'}</span>
                        </span>
                        <span className="block text-xs text-gray-600">
                          {c.blocked
                            ? <span className="font-semibold text-gray-700">{c.blocked}</span>
                            : c.timesNotified
                              ? `Avisado ${c.timesNotified} ${c.timesNotified === 1 ? 'vez' : 'veces'} · último ${formatDistanceToNow(new Date(c.lastNotifiedAt!), { addSuffix: true, locale: es })}`
                              : 'Aún no avisado por esta solicitud'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
