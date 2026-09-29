'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { BookingStatus } from '@prisma/client'
import {
  ArrowLeft, Bell, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, Flag, LifeBuoy, Loader2, MapPin,
  MessageCircle, Phone, Mail, RefreshCw, Send, Star, UserCheck, Wallet, XCircle,
} from 'lucide-react'
import { channelLabel } from '@/lib/ops/origin'
import { zoneName } from '@/lib/geo/zones'
import { BOOKING_STATUS_LABEL } from '@/lib/bookings/transitions'
import { AttentionPanel } from '@/components/admin/requests/AttentionPanel'
import { BookingSection } from '@/components/admin/requests/BookingSection'
import { ChatThread, type ChatThreadHandle } from '@/components/admin/requests/ChatThread'
import type { ActionBody, Case, Intervention, Recipient } from '@/components/admin/requests/types'
import {
  BOOKING_STATUS, Chip, Field, Lightbox, PROPOSAL_STATUS, REQUEST_STATUS, Section, Sheet, Thumbs,
  btn, cop, day, input, statusChip, when,
} from '@/components/admin/requests/ui'

type SheetState =
  | null
  | { kind: 'status'; to: BookingStatus }
  | { kind: 'reschedule' }
  | { kind: 'cancel'; reopen: boolean }
  | { kind: 'case' }
  | { kind: 'confirm'; action: 'renotify' | 'reactivate' }

type Notice = { ok: boolean; text: string } | null

const TOUCH_KEYS: Array<[string, string]> = [['source', 'Fuente'], ['medium', 'Medio'], ['campaign', 'Campaña'], ['content', 'Contenido'], ['ref', 'Ref'], ['adId', 'Anuncio'], ['channel', 'Canal'], ['at', 'Fecha']]

function touchRows(t: unknown): Array<[string, string]> {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return []
  const o = t as Record<string, unknown>
  return TOUCH_KEYS.flatMap(([k, l]) => {
    const v = o[k]
    if (typeof v !== 'string' || !v) return []
    return [[l, k === 'at' ? when(v) : k === 'channel' ? channelLabel(v) : v] as [string, string]]
  })
}

const originLabel = (via: string | null | undefined) => (via === 'chat' ? 'Chat' : via === 'admin' ? 'Admin' : 'App')

export default function RequestCasePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Case | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const chatRefs = useRef<Record<string, ChatThreadHandle | null>>({})
  const [chatFocus, setChatFocus] = useState<{ id: string; to: Recipient; n: number } | null>(null)

  useEffect(() => {
    if (chatFocus) chatRefs.current[chatFocus.id]?.focusWith(chatFocus.to)
  }, [chatFocus])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/service-requests/${id}`, { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'No se pudo cargar la solicitud'); return }
      setError(null)
      setData(d)
    } catch {
      setError('No se pudo cargar la solicitud')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const run = useCallback(async (body: ActionBody, ok: (r: Record<string, unknown>) => string): Promise<boolean> => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/service-requests/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setNotice({ ok: false, text: d.error ?? 'No se pudo completar la acción' }); return false }
      setNotice({ ok: true, text: ok(d) })
      await load()
      return true
    } catch {
      setNotice({ ok: false, text: 'Error de red, intenta de nuevo' })
      return false
    } finally {
      setBusy(false)
    }
  }, [id, load])

  const openImage = useCallback((urls: string[], index: number) => setLightbox({ urls, index }), [])

  const mainProposal = () => {
    if (!data) return null
    return data.proposals.find((p) => p.status === 'ACCEPTED') ?? data.proposals.find((p) => p.chat) ?? data.proposals[0] ?? null
  }

  const intervene = (i: Intervention) => {
    if (!data) return
    switch (i) {
      case 'renotify':
      case 'reactivate':
        setSheet({ kind: 'confirm', action: i })
        return
      case 'message_client':
      case 'message_partner':
      case 'message_both': {
        const p = mainProposal()
        if (!p) { setNotice({ ok: false, text: 'No hay propuestas: todavía no existe un chat con un socio.' }); return }
        const to: Recipient = i === 'message_client' ? 'client' : i === 'message_partner' ? 'partner' : 'both'
        setChatFocus({ id: p.id, to, n: Date.now() })
        return
      }
      case 'reschedule': setSheet({ kind: 'reschedule' }); return
      case 'cancel_booking': setSheet({ kind: 'cancel', reopen: false }); return
      case 'reopen_to_others': setSheet({ kind: 'cancel', reopen: true }); return
      case 'open_case': setSheet({ kind: 'case' }); return
      case 'review_payment': document.getElementById('pago')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return
      case 'review_guarantee': window.location.href = '/admin/guarantee'; return
    }
  }

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="mr-3 h-7 w-7 animate-spin" /><span className="text-sm font-medium">Cargando solicitud…</span></div>
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? 'Solicitud no encontrada'}</div>
      </div>
    )
  }

  const c = data
  const b = c.booking
  const zone = zoneName(c.zone)
  const requestPhotos = c.photos.map((p) => p.url)

  return (
    <div className="space-y-4 pb-6 sm:space-y-5">
      <BackLink />

      {/* Header */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-gray-900 sm:text-2xl">{c.service.name} <span className="text-base font-semibold text-gray-400">#{c.ref}</span></h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {statusChip(REQUEST_STATUS, c.status)}
              {b && statusChip(BOOKING_STATUS, b.status)}
              {c.isUrgent && <Chip cls="bg-orange-100 text-orange-700">Urgente</Chip>}
              {c.direct && <Chip cls="bg-purple-100 text-purple-700">Directa a {c.direct.name ?? 'socio'}</Chip>}
              <Chip cls="bg-gray-100 text-gray-700">
                {originLabel(c.origin.via)}{c.origin.channel ? ` · ${channelLabel(c.origin.channel)}` : ''}
              </Chip>
              {c.origin.conversation && (
                <Link href={`/admin/inbox?c=${encodeURIComponent(c.origin.conversation.id)}`} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                  <MessageCircle className="h-3 w-3" /> Ver conversación{c.origin.conversation.contactName ? ` · ${c.origin.conversation.contactName}` : ''}
                </Link>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">Creada {when(c.createdAt)} · {c.status === 'ACTIVE' ? 'vence' : 'vencía'} {when(c.expiresAt)}</p>
          </div>
          <button type="button" onClick={load} className={`${btn.ghost} self-start`}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className={`sticky top-2 z-30 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {notice.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <span className="min-w-0 flex-1 break-words">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Cerrar</button>
        </div>
      )}

      {/* Attention */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900"><Flag className="h-4 w-4 text-primary-500" /> Atención</h2>
        <AttentionPanel flags={c.flags} onIntervene={intervene} busy={busy} hasBooking={Boolean(b)} />
      </div>

      {/* Request */}
      <Section title="Solicitud" icon={<ClipboardList className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cliente">
            <Link href={`/admin/users/${c.client.id}`} className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline">
              {c.client.name ?? 'Sin nombre'} <ExternalLink className="h-3 w-3" />
            </Link>
            {!c.client.isActive && <Chip cls="ml-2 bg-red-100 text-red-700">Inactivo</Chip>}
            {c.client.phone && <a href={`tel:${c.client.phone}`} className="mt-0.5 flex items-center gap-1 text-gray-600"><Phone className="h-3 w-3" /> {c.client.phone}</a>}
            {c.client.email && <a href={`mailto:${c.client.email}`} className="mt-0.5 flex items-center gap-1 break-all text-gray-600"><Mail className="h-3 w-3 flex-shrink-0" /> {c.client.email}</a>}
          </Field>
          <Field label="Dirección">
            <p className="flex items-start gap-1"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" /> <span>{c.address}</span></p>
            <p className="mt-0.5 text-gray-500">{c.city}{zone ? ` · ${zone}` : ''}</p>
          </Field>
          <Field label="Cuándo">
            {c.isUrgent ? <span className="font-semibold text-orange-600">Urgente</span> : c.preferredDate ? (
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-gray-400" /> {day(c.preferredDate)}{c.preferredTime ? ` · ${c.preferredTime}` : ''}</span>
            ) : <span className="text-gray-400">Sin fecha</span>}
          </Field>
          <Field label="Presupuesto">{c.budget != null ? cop(c.budget) : <span className="text-gray-400">—</span>}</Field>
          {c.notes && <div className="sm:col-span-2 lg:col-span-3"><Field label="Notas"><p className="whitespace-pre-wrap">{c.notes}</p></Field></div>}
        </div>
        {requestPhotos.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Fotos ({requestPhotos.length})</p>
            <Thumbs urls={requestPhotos} onOpen={openImage} />
          </div>
        )}
      </Section>

      {/* Notified */}
      <Section title="Socios avisados" icon={<Bell className="h-4 w-4" />} count={c.notified.length} defaultOpen={false}>
        {!c.notified.length ? <p className="text-sm text-gray-400">No hay avisos registrados.</p> : (
          <ul className="divide-y divide-gray-100">
            {c.notified.map((n, i) => (
              <li key={`${n.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-gray-900">{n.name ?? 'Sin nombre'}</span>
                <span className="flex flex-shrink-0 items-center gap-2 text-xs text-gray-500">
                  {when(n.at)}
                  <Chip cls={n.read ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>{n.read ? 'Leído' : 'Sin leer'}</Chip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Proposals */}
      <Section title="Propuestas" icon={<UserCheck className="h-4 w-4" />} count={c.proposals.length}>
        {!c.proposals.length ? <p className="text-sm text-gray-400">Aún no hay propuestas.</p> : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {c.proposals.map((p) => (
              <div key={p.id} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${p.status === 'ACCEPTED' ? 'border-green-200 bg-green-50/40' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{p.partner.name ?? 'Socio'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {p.partner.rating?.toFixed(1) ?? '—'} ({p.partner.reviews ?? 0})</span>
                      <span>{p.partner.jobs ?? 0} trabajos</span>
                      {p.partner.phone && <a href={`tel:${p.partner.phone}`} className="hover:underline">{p.partner.phone}</a>}
                    </p>
                  </div>
                  {statusChip(PROPOSAL_STATUS, p.status)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Precio"><span className="font-bold text-green-700">{cop(p.price)}</span></Field>
                  <Field label="Propone">{p.proposedDate ? `${day(p.proposedDate)}${p.proposedTime ? ` · ${p.proposedTime}` : ''}` : p.proposedTime ?? '—'}</Field>
                </div>
                {p.notes && <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-2 text-sm text-gray-700">{p.notes}</p>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>#{p.ref} · {when(p.createdAt)}{p.origin && p.origin !== 'app' ? ` · ${originLabel(p.origin)}` : ''}</span>
                  {p.partner.slug && <Link href={`/pro/${p.partner.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline">Perfil <ExternalLink className="h-3 w-3" /></Link>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Chats */}
      {c.proposals.map((p) => (
        <Section key={p.id} title={`Chat con ${p.partner.name ?? 'socio'}`} icon={<MessageCircle className="h-4 w-4" />} count={p.chat?.messages.length ?? 0} defaultOpen={p.status === 'ACCEPTED' || c.proposals.length === 1} openSignal={chatFocus?.id === p.id ? chatFocus.n : undefined}>
          <ChatThread
            ref={(h) => { chatRefs.current[p.id] = h }}
            proposal={p}
            clientName={c.client.name}
            onOpenImage={openImage}
            onSend={(text, to) => run({ action: 'chat_message', proposalId: p.id, text, to }, () => `Mensaje enviado ${to === 'client' ? 'al cliente' : to === 'partner' ? 'al socio' : 'a los dos'}`)}
          />
        </Section>
      ))}

      {/* Booking */}
      {b ? (
        <Section title="Reserva" icon={<Wallet className="h-4 w-4" />}>
          <BookingSection
            booking={b}
            busy={busy}
            onOpenImage={openImage}
            actions={{
              onStatus: (to) => setSheet({ kind: 'status', to }),
              onReschedule: () => setSheet({ kind: 'reschedule' }),
              onCancel: (reopen) => setSheet({ kind: 'cancel', reopen }),
            }}
          />
          {c.otherBookings.length > 0 && (
            <p className="mt-4 text-xs text-gray-500">Otras reservas de esta solicitud: {c.otherBookings.map((o) => `#${o.id.slice(-6)} (${BOOKING_STATUS_LABEL[o.status as BookingStatus] ?? o.status})`).join(', ')}</p>
          )}
        </Section>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">Esta solicitud aún no tiene reserva.</div>
      )}

      {/* Support cases */}
      <Section
        title="Casos de soporte"
        icon={<LifeBuoy className="h-4 w-4" />}
        count={c.supportCases.length}
        defaultOpen={c.supportCases.length > 0}
        right={<button type="button" onClick={() => setSheet({ kind: 'case' })} className={`${btn.small} border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100`}>Abrir caso</button>}
      >
        {!c.supportCases.length ? <p className="text-sm text-gray-400">Sin casos.</p> : (
          <ul className="space-y-2">
            {c.supportCases.map((s) => (
              <li key={s.id} className="rounded-2xl border border-gray-100 p-3 text-sm">
                <p className="break-words font-semibold text-gray-900">{s.subject}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <Chip cls="bg-gray-100 text-gray-700">{s.status}</Chip>
                  <Chip cls={s.priority === 'CRITICAL' || s.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}>{s.priority}</Chip>
                  <span>{s.queue} · {when(s.createdAt)}</span>
                </div>
              </li>
            ))}
            <li><Link href="/admin/operations" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">Ver en Operaciones <ExternalLink className="h-3 w-3" /></Link></li>
          </ul>
        )}
      </Section>

      {/* Origin */}
      <Section title="Origen" icon={<Send className="h-4 w-4" />} defaultOpen={false}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([['Primer contacto', c.origin.acquisition], ['Último contacto', c.origin.lastTouch]] as const).map(([title, t]) => {
            const rows = touchRows(t)
            return (
              <div key={title} className="min-w-0 rounded-2xl border border-gray-100 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
                {!rows.length ? <p className="text-sm text-gray-400">Sin datos.</p> : (
                  <dl className="space-y-1 text-sm">
                    {rows.map(([l, v]) => (
                      <div key={l} className="flex gap-2">
                        <dt className="w-20 flex-shrink-0 text-gray-500">{l}</dt>
                        <dd className="min-w-0 break-all text-gray-900">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {sheet && <ActionSheet sheet={sheet} data={c} busy={busy} run={run} onClose={() => setSheet(null)} />}
      {lightbox && <Lightbox urls={lightbox.urls} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/admin/service-requests" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" /> Solicitudes
    </Link>
  )
}

function ActionSheet({ sheet, data, busy, run, onClose }: {
  sheet: NonNullable<SheetState>
  data: Case
  busy: boolean
  run: (body: ActionBody, ok: (r: Record<string, unknown>) => string) => Promise<boolean>
  onClose: () => void
}) {
  const b = data.booking
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => (b ? b.scheduledDate.slice(0, 10) : ''))
  const [time, setTime] = useState(() => b?.scheduledTime ?? '')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')

  const done = async (p: Promise<boolean>) => { if (await p) onClose() }
  const spin = busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null
  const cancelBtn = <button type="button" onClick={onClose} className={btn.ghost}>Volver</button>

  if (sheet.kind === 'confirm') {
    const renotify = sheet.action === 'renotify'
    return (
      <Sheet title={renotify ? 'Volver a avisar a los socios' : 'Reactivar la solicitud'} onClose={onClose} footer={<>{cancelBtn}<button type="button" disabled={busy} className={btn.primary} onClick={() => done(run({ action: sheet.action }, (r) => renotify ? `Se avisó de nuevo a ${typeof r.partners === 'number' ? r.partners : 'los'} socios` : 'Solicitud reactivada por 24 h'))}>{spin} Confirmar</button></>}>
        <p className="text-gray-700">{renotify ? 'Se enviará de nuevo el aviso a los socios que cubren este servicio y zona (máximo 3 veces desde el admin).' : 'La solicitud vuelve a quedar activa 24 horas para que el cliente elija o lleguen más propuestas.'}</p>
      </Sheet>
    )
  }

  if (sheet.kind === 'case') {
    return (
      <Sheet title="Abrir caso de soporte" onClose={onClose} footer={<>{cancelBtn}<button type="button" disabled={busy || subject.trim().length < 3} className={btn.primary} onClick={() => done(run({ action: 'open_case', subject: subject.trim(), description: description.trim(), priority }, () => 'Caso de soporte abierto'))}>{spin} Abrir caso</button></>}>
        <label className="block"><span className="text-xs font-semibold text-gray-500">Asunto</span><input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 200))} className={`${input} mt-1`} placeholder="Ej.: el socio no llegó" /></label>
        <label className="block"><span className="text-xs font-semibold text-gray-500">Descripción</span><textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 4000))} rows={4} className={`${input} mt-1`} /></label>
        <label className="block"><span className="text-xs font-semibold text-gray-500">Prioridad</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={`${input} mt-1 bg-white`}>
            <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
          </select>
        </label>
      </Sheet>
    )
  }

  if (!b) {
    return <Sheet title="Sin reserva" onClose={onClose} footer={cancelBtn}><p className="text-gray-600">Esta solicitud no tiene reserva.</p></Sheet>
  }

  if (sheet.kind === 'reschedule') {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    return (
      <Sheet title={`Reprogramar reserva #${b.ref}`} onClose={onClose} footer={<>{cancelBtn}<button type="button" disabled={busy || !valid} className={btn.primary} onClick={() => done(run({ action: 'reschedule', bookingId: b.id, date, time }, () => `Reserva reprogramada para ${date} ${time}`))}>{spin} Reprogramar</button></>}>
        <p className="text-gray-600">Ahora: {day(b.scheduledDate)} · {b.scheduledTime}. Se avisa al cliente y al socio.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0"><span className="text-xs font-semibold text-gray-500">Fecha</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1`} /></label>
          <label className="block min-w-0"><span className="text-xs font-semibold text-gray-500">Hora</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} mt-1`} /></label>
        </div>
      </Sheet>
    )
  }

  if (sheet.kind === 'cancel') {
    const ok = reason.trim().length >= 5
    return (
      <Sheet title={sheet.reopen ? 'Cancelar y reabrir a otros socios' : `Cancelar reserva #${b.ref}`} onClose={onClose} footer={<>{cancelBtn}<button type="button" disabled={busy || !ok} className={btn.danger} onClick={() => done(run({ action: 'booking_status', bookingId: b.id, status: 'CANCELLED', reason: reason.trim(), reopen: sheet.reopen }, () => sheet.reopen ? 'Reserva cancelada y solicitud reabierta a otros socios' : 'Reserva cancelada'))}>{spin} {sheet.reopen ? 'Cancelar y reabrir' : 'Cancelar reserva'}</button></>}>
        <p className="text-gray-600">{sheet.reopen ? 'La reserva se cancela y la solicitud vuelve a quedar abierta para que otros socios propongan.' : 'La reserva se cancela definitivamente.'}</p>
        <label className="block"><span className="text-xs font-semibold text-gray-500">Motivo (lo verán el cliente y el socio)</span><textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={3} className={`${input} mt-1`} placeholder="Mínimo 5 caracteres" /></label>
      </Sheet>
    )
  }

  const to = sheet.to
  if (to === 'CANCELLED') return null
  return (
    <Sheet title="Cambiar estado de la reserva" onClose={onClose} footer={<>{cancelBtn}<button type="button" disabled={busy} className={btn.primary} onClick={() => done(run({ action: 'booking_status', bookingId: b.id, status: to as 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' }, () => `Reserva pasada a «${BOOKING_STATUS_LABEL[to]}»`))}>{spin} Confirmar</button></>}>
      <p className="text-gray-700">La reserva pasa de «{BOOKING_STATUS_LABEL[b.status as BookingStatus] ?? b.status}» a «{BOOKING_STATUS_LABEL[to]}». Se registra como acción del admin y se avisa a las partes.</p>
    </Sheet>
  )
}
