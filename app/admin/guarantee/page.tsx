'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react'
import OriginBadge from '@/components/shared/OriginBadge'
import {
  REMEDY_LABEL, STATUS_LABEL, STRIKES_TO_PAUSE, TYPE_LABEL, strikeSuggested,
  type GuaranteeRemedy, type GuaranteeStatus, type GuaranteeType, type RemedyOption,
} from '@/lib/guarantee/policy'

type ClaimRow = {
  id: string
  type: GuaranteeType
  status: GuaranteeStatus
  description: string
  slaDueAt: string
  createdAt: string
  remedy: string | null
  partnerStrike: boolean
  origin: string
  originChannel: string | null
  originConversationId: string | null
  overdue: boolean
  partnerStrikes: number
  booking: {
    id: string
    status: string
    totalPrice: number
    service: { name: string } | null
    user: { id: string; name: string | null } | null
    partner: { id: string; user: { name: string | null } | null } | null
  }
}

type Stats = { open: number; overdue: number; strikesLast90: number; partnersAtLimit: Array<{ partnerId: string; strikes: number }> }

type Detail = {
  claim: ClaimRow & {
    photoUrls: string[]
    resolutionNote: string | null
    booking: ClaimRow['booking'] & {
      address: string
      scheduledDate: string
      scheduledTime: string
      user: { id: string; name: string | null; email: string; phone: string | null } | null
      partner: { id: string; isAvailable: boolean; user: { id: string; name: string | null; email: string; phone: string | null } | null } | null
      payment: { status: string; totalAmount: number; clientReportedMethod: string | null } | null
      events: Array<{ id: string; type: string; toStatus: string | null; actorType: string; detail: string | null; createdAt: string }>
      refundCases: Array<{ id: string; status: string; requestedAmount: number; approvedAmount: number | null }>
    }
  }
  partnerStrikes: number
  partnerHistory: Array<{ id: string; type: GuaranteeType; status: GuaranteeStatus; partnerStrike: boolean; createdAt: string }>
  paidOnline: boolean
  remedies: RemedyOption[]
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'active', label: 'Activos' },
  { id: 'overdue', label: 'Vencidos' },
  { id: 'closed', label: 'Cerrados' },
  { id: 'all', label: 'Todos' },
]

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const day = (d: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d))
const when = (d: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d))

function dueText(slaDueAt: string, active: boolean) {
  if (!active) return '—'
  const mins = Math.round((new Date(slaDueAt).getTime() - Date.now()) / 60_000)
  const abs = Math.abs(mins)
  const span = abs >= 60 * 24 ? `${Math.floor(abs / 1440)} d ${Math.floor((abs % 1440) / 60)} h` : abs >= 60 ? `${Math.floor(abs / 60)} h` : `${abs} min`
  return mins < 0 ? `Vencido hace ${span}` : `Vence en ${span}`
}

const ACTIVE: GuaranteeStatus[] = ['OPEN', 'REDO_SCHEDULED', 'REFUND_REVIEW']
const STATUS_STYLE: Record<GuaranteeStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  REDO_SCHEDULED: 'bg-blue-100 text-blue-800',
  REFUND_REVIEW: 'bg-violet-100 text-violet-800',
  REASSIGNED: 'bg-emerald-100 text-emerald-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-gray-100 text-gray-700',
}
const TYPE_STYLE: Record<GuaranteeType, string> = {
  NO_SHOW: 'bg-red-50 text-red-700 border-red-200',
  BAD_WORK: 'bg-orange-50 text-orange-700 border-orange-200',
  DAMAGE: 'bg-rose-50 text-rose-800 border-rose-300',
}

function StrikesChip({ n }: { n: number }) {
  if (!n) return <span className="text-xs text-gray-400">0 faltas</span>
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${n >= STRIKES_TO_PAUSE ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{n} falta{n === 1 ? '' : 's'}</span>
}

export default function AdminGuaranteePage() {
  const [filter, setFilter] = useState('active')
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/guarantee?status=${filter}`)
      const data = await res.json()
      setClaims(data.claims ?? [])
      setStats(data.stats ?? null)
      setUnavailable(Boolean(data.unavailable))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl"><ShieldCheck className="h-7 w-7 text-primary-500" /> Garantía</h1>
          <p className="text-sm text-gray-600">Reclamos de clientes: el socio no llegó, trabajo mal hecho o daño. Resolver en máximo 72 h. <Link href="/garantia" target="_blank" className="font-semibold text-primary-600 hover:underline">Ver la política</Link></p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Activos" value={stats.open} />
          <Stat label="Vencidos" value={stats.overdue} danger={stats.overdue > 0} />
          <Stat label="Faltas en 90 días" value={stats.strikesLast90} />
          <Stat label={`Socios con ${STRIKES_TO_PAUSE}+ faltas`} value={stats.partnersAtLimit.length} danger={stats.partnersAtLimit.length > 0} />
        </div>
      )}

      {unavailable && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> La tabla de garantía aún no existe en la base: hay que correr su SQL en Supabase.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f.id ? 'bg-primary-500 text-white shadow' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && !claims.length ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
      ) : !claims.length ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">No hay reclamos en esta vista.</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {claims.map((c) => {
              const active = ACTIVE.includes(c.status)
              return (
                <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[c.type]}`}>{TYPE_LABEL[c.type]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{c.booking.service?.name ?? 'Servicio'} · #{c.booking.id.slice(-6)}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{c.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className={c.overdue ? 'font-bold text-red-600' : ''}>{dueText(c.slaDueAt, active)}</span>
                    <span>Cliente: {c.booking.user?.name ?? '—'}</span>
                    <span>Socio: {c.booking.partner?.user?.name ?? '—'}</span>
                    <StrikesChip n={c.partnerStrikes} />
                    <OriginBadge origin={c.origin} originChannel={c.originChannel} originConversationId={c.originConversationId} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3">Reserva</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((c) => {
                  const active = ACTIVE.includes(c.status)
                  return (
                    <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TYPE_STYLE[c.type]}`}>{TYPE_LABEL[c.type]}</span></td>
                      <td className={`whitespace-nowrap px-4 py-3 ${c.overdue ? 'font-bold text-red-600' : 'text-gray-600'}`}>{dueText(c.slaDueAt, active)}</td>
                      <td className="px-4 py-3 text-gray-900">{c.booking.service?.name ?? 'Servicio'} <span className="text-gray-400">#{c.booking.id.slice(-6)}</span></td>
                      <td className="px-4 py-3 text-gray-700">{c.booking.user?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700"><div className="flex items-center gap-2"><span>{c.booking.partner?.user?.name ?? '—'}</span><StrikesChip n={c.partnerStrikes} /></div></td>
                      <td className="px-4 py-3">{c.origin === 'chat' ? <OriginBadge origin={c.origin} originChannel={c.originChannel} originConversationId={c.originConversationId} /> : <span className="text-xs text-gray-500">{c.origin === 'admin' ? 'Admin' : 'App'}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {openId && <ClaimPanel id={openId} onClose={() => setOpenId(null)} onResolved={() => { setOpenId(null); load() }} />}
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${danger ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${danger ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function ClaimPanel({ id, onClose, onResolved }: { id: string; onClose: () => void; onResolved: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remedy, setRemedy] = useState<GuaranteeRemedy | null>(null)
  const [note, setNote] = useState('')
  const [strike, setStrike] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/guarantee/${id}`).then(async (r) => {
      const d = await r.json()
      if (!r.ok) setError(d.error ?? 'No se pudo cargar')
      else setDetail(d)
    }).catch(() => setError('No se pudo cargar'))
  }, [id])

  const choose = (r: GuaranteeRemedy) => {
    setRemedy(r)
    if (detail) setStrike(strikeSuggested(detail.claim.type, r))
  }

  const submit = async () => {
    if (!remedy) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/guarantee/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remedy, note, partnerStrike: strike }) })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'No se pudo resolver'); return }
      onResolved()
    } finally {
      setSaving(false)
    }
  }

  const c = detail?.claim
  const active = c ? ACTIVE.includes(c.status) : false

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <p className="min-w-0 truncate text-base font-bold text-gray-900">{c ? `${TYPE_LABEL[c.type]} · #${c.booking.id.slice(-6)}` : 'Reclamo'}</p>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {!detail && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
          {c && detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                <span className={`text-xs ${c.overdue ? 'font-bold text-red-600' : 'text-gray-500'}`}>{dueText(c.slaDueAt, active)}</span>
                <OriginBadge origin={c.origin} originChannel={c.originChannel} originConversationId={c.originConversationId} />
              </div>
              <p className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-3 text-gray-800">{c.description}</p>
              {c.photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {c.photoUrls.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-xl border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="Foto del reclamo" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Box title="Reserva">
                  <p>{c.booking.service?.name} · {cop(c.booking.totalPrice)}</p>
                  <p className="text-gray-500">{day(c.booking.scheduledDate)} {c.booking.scheduledTime}</p>
                  <p className="break-words text-gray-500">{c.booking.address}</p>
                  <p className="text-gray-500">Pago: {c.booking.payment ? `${c.booking.payment.status}${detail.paidOnline ? ' · en línea' : c.booking.payment.clientReportedMethod ? ` · ${c.booking.payment.clientReportedMethod === 'CASH' ? 'efectivo' : 'transferencia'}` : ''}` : 'sin registro'}</p>
                </Box>
                <Box title="Personas">
                  <p>Cliente: {c.booking.user?.name ?? '—'}{c.booking.user?.phone ? ` · ${c.booking.user.phone}` : ''}</p>
                  <p>Socio: {c.booking.partner?.user?.name ?? '—'}{c.booking.partner?.user?.phone ? ` · ${c.booking.partner.user.phone}` : ''}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><StrikesChip n={detail.partnerStrikes} />{c.booking.partner && !c.booking.partner.isAvailable && <span className="text-xs font-semibold text-red-600">Pausado</span>}</div>
                  {c.booking.user && <Link href={`/admin/users/${c.booking.user.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">Ver cliente <ExternalLink className="h-3 w-3" /></Link>}
                </Box>
              </div>

              {detail.partnerHistory.length > 0 && (
                <Box title="Otros reclamos del socio">
                  {detail.partnerHistory.map((h) => <p key={h.id} className="text-gray-600">{when(h.createdAt)} · {TYPE_LABEL[h.type]} · {STATUS_LABEL[h.status]}{h.partnerStrike ? ' · falta' : ''}</p>)}
                </Box>
              )}
              {c.booking.refundCases.length > 0 && (
                <Box title="Reembolsos">
                  {c.booking.refundCases.map((r) => <p key={r.id} className="text-gray-600">#{r.id.slice(-6)} · {r.status} · {cop(r.approvedAmount ?? r.requestedAmount)}</p>)}
                </Box>
              )}
              {c.resolutionNote && <Box title="Resolución"><p className="whitespace-pre-wrap text-gray-700">{c.remedy ? `${REMEDY_LABEL[c.remedy as GuaranteeRemedy] ?? c.remedy}: ` : ''}{c.resolutionNote}</p></Box>}

              {active && (
                <div className="space-y-3">
                  <p className="font-semibold text-gray-900">Qué aplica según la política</p>
                  <div className="grid grid-cols-1 gap-2">
                    {detail.remedies.map((r) => (
                      <button key={r.remedy} onClick={() => choose(r.remedy)} className={`rounded-2xl border p-3 text-left transition ${remedy === r.remedy ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:bg-gray-50'} ${r.remedy === 'reject' ? 'text-gray-600' : ''}`}>
                        <p className="font-semibold">{r.label}</p>
                        <p className="text-xs text-gray-500">{r.detail}</p>
                      </button>
                    ))}
                  </div>
                  {remedy && (
                    <>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Qué se decidió y por qué (lo verá el equipo; al cliente le llega el resumen)" className="w-full rounded-2xl border border-gray-200 p-3 text-sm focus:border-primary-500 focus:outline-none" />
                      {remedy !== 'reject' && c.booking.partner && (
                        <label className="flex items-start gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" />
                          <span>Contar como falta del socio {detail.partnerStrikes + 1 >= STRIKES_TO_PAUSE && strike ? <strong className="text-red-600">(con esta llega a {detail.partnerStrikes + 1}: se pausa su disponibilidad)</strong> : ''}</span>
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {active && (
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-end">
            <button onClick={onClose} className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700">Cancelar</button>
            <button disabled={!remedy || note.trim().length < 5 || saving} onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-100 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
