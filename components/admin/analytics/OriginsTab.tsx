'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Card, Kpi, money, num } from '@/components/admin/analytics/ui'

type Row = {
  key: string
  channelLabel: string
  label: string
  conversations: number
  requests: number
  bookings: number
  completed: number
  sales: number
  spend: number
  costPerRequest: number | null
  costPerBooking: number | null
}
type Data = {
  model: 'last' | 'first'
  totals: { conversations: number; requests: number; bookings: number; completed: number; sales: number; spend: number; costPerRequest: number | null }
  channels: Row[]
  campaigns: Row[]
  pieces: Row[]
  requestsWithoutData: number
}

const cop = (n: number | null) => (n == null ? '—' : money(n))

function FunnelTable({ rows, empty, showChannel }: { rows: Row[]; empty: string; showChannel?: boolean }) {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>
  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <div key={r.key} className="rounded-xl border border-gray-100 p-3">
            <p className="break-words text-sm font-semibold text-gray-900">{r.label}</p>
            {showChannel && <p className="text-xs text-gray-500">{r.channelLabel}</p>}
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><dt className="text-[10px] uppercase text-gray-500">Chats</dt><dd className="text-sm font-semibold tabular-nums">{num(r.conversations)}</dd></div>
              <div><dt className="text-[10px] uppercase text-gray-500">Solicitudes</dt><dd className="text-sm font-semibold tabular-nums">{num(r.requests)}</dd></div>
              <div><dt className="text-[10px] uppercase text-gray-500">Reservas</dt><dd className="text-sm font-semibold tabular-nums">{num(r.bookings)}</dd></div>
              <div><dt className="text-[10px] uppercase text-gray-500">Completadas</dt><dd className="text-sm font-semibold tabular-nums">{num(r.completed)}</dd></div>
              <div><dt className="text-[10px] uppercase text-gray-500">Ventas</dt><dd className="text-sm font-semibold tabular-nums">{money(r.sales)}</dd></div>
              <div><dt className="text-[10px] uppercase text-gray-500">Gasto</dt><dd className="text-sm font-semibold tabular-nums">{r.spend ? money(r.spend) : '—'}</dd></div>
            </dl>
            {(r.costPerRequest != null || r.costPerBooking != null) && (
              <p className="mt-2 text-xs text-gray-600">Costo por solicitud <strong>{cop(r.costPerRequest)}</strong> · por reserva <strong>{cop(r.costPerBooking)}</strong></p>
            )}
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="py-2 pr-3 font-medium">Origen</th>
              <th className="px-2 py-2 text-right font-medium">Chats</th>
              <th className="px-2 py-2 text-right font-medium">Solicitudes</th>
              <th className="px-2 py-2 text-right font-medium">Reservas</th>
              <th className="px-2 py-2 text-right font-medium">Completadas</th>
              <th className="px-2 py-2 text-right font-medium">Ventas</th>
              <th className="px-2 py-2 text-right font-medium">Gasto</th>
              <th className="px-2 py-2 text-right font-medium">$/solicitud</th>
              <th className="py-2 pl-2 text-right font-medium">$/reserva</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-gray-50 last:border-0">
                <td className="max-w-[320px] py-2 pr-3"><p className="truncate text-gray-900" title={r.label}>{r.label}</p>{showChannel && <p className="text-xs text-gray-500">{r.channelLabel}</p>}</td>
                <td className="px-2 py-2 text-right tabular-nums">{num(r.conversations)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{num(r.requests)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{num(r.bookings)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{num(r.completed)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(r.sales)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.spend ? money(r.spend) : '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums">{cop(r.costPerRequest)}</td>
                <td className="py-2 pl-2 text-right tabular-nums">{cop(r.costPerBooking)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function OriginsTab({ d, model, onModel }: { d: Record<string, unknown>; model: 'last' | 'first'; onModel: (m: 'last' | 'first') => void }) {
  const data = d as unknown as Data
  const t = data.totals
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {model === 'last' ? 'Cada solicitud cuenta para lo último que trajo a la persona (anuncio, publicación, página) antes de pedir.' : 'Cada solicitud cuenta para lo primero que trajo a la persona a LoHaggo.'}
        </p>
        <div className="flex rounded-xl border border-gray-200 bg-white p-0.5 text-sm">
          {(['last', 'first'] as const).map((m) => (
            <button key={m} onClick={() => onModel(m)} className={`rounded-lg px-3 py-1.5 ${model === m ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{m === 'last' ? 'Último toque' : 'Primer toque'}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Chats nuevos" value={num(t.conversations)} />
        <Kpi label="Solicitudes" value={num(t.requests)} />
        <Kpi label="Reservas" value={num(t.bookings)} />
        <Kpi label="Completadas" value={num(t.completed)} />
        <Kpi label="Gasto en pauta" value={t.spend ? money(t.spend) : '—'} hint={t.spend ? undefined : 'cárgalo en Marketing → Pauta'} />
        <Kpi label="Costo por solicitud (pauta)" value={cop(t.costPerRequest)} hint="meta: < $25.000" />
      </div>

      {data.requestsWithoutData > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{data.requestsWithoutData === 1 ? '1 solicitud del periodo no tiene' : `${num(data.requestsWithoutData)} solicitudes del periodo no tienen`} origen guardado (se crearon antes de medirlo).</p>
      )}

      <Card title="Por canal" subtitle="Chat → solicitud → reserva → completada → ventas">
        <FunnelTable rows={data.channels} empty="Sin actividad en este periodo." />
      </Card>
      <Card title="Por campaña o pauta" subtitle="Pautas de Marketing → Pauta y campañas con UTM; el gasto se divide aquí">
        <FunnelTable rows={data.campaigns} empty="Todavía no hay solicitudes ni gasto con campaña." showChannel />
      </Card>
      <Card title="Por pieza" subtitle="Anuncio, publicación de Instagram/Facebook o artículo del blog">
        <FunnelTable rows={data.pieces} empty="Todavía no hay piezas con resultados." showChannel />
      </Card>
      <ConversionsConnect />
    </div>
  )
}

type ConvInfo = {
  metaPixelId: string | null
  metaTokenSet: boolean
  metaTestEventCode: string | null
  metaWabaId: string | null
  ga4MeasurementId: string | null
  ga4ApiSecretSet: boolean
  stats: { rows: Array<{ destination: string; event: string; status: string; count: number }>; lastFailed: { destination: string; event: string; detail: string | null; createdAt: string } | null }
  canEdit: boolean
}

const DEST = { meta_capi: 'Meta (API de Conversiones)', ga4_mp: 'Google Analytics 4' } as Record<string, string>

/** Where the Lead / Purchase conversions go; secrets are typed here once and stored encrypted. */
function ConversionsConnect() {
  const [info, setInfo] = useState<ConvInfo | null>(null)
  const [f, setF] = useState({ metaPixelId: '', metaToken: '', metaTestEventCode: '', metaWabaId: '', ga4MeasurementId: '', ga4ApiSecret: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const apply = (d: ConvInfo) => {
    setInfo(d)
    setF({ metaPixelId: d.metaPixelId ?? '', metaToken: '', metaTestEventCode: d.metaTestEventCode ?? '', metaWabaId: d.metaWabaId ?? '', ga4MeasurementId: d.ga4MeasurementId ?? '', ga4ApiSecret: '' })
  }
  useEffect(() => { fetch('/api/admin/analytics/conversions').then((r) => r.json()).then(apply).catch(() => null) }, [])
  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const body: Record<string, string> = { metaPixelId: f.metaPixelId, metaTestEventCode: f.metaTestEventCode, metaWabaId: f.metaWabaId, ga4MeasurementId: f.ga4MeasurementId }
    if (f.metaToken.trim()) body.metaToken = f.metaToken
    if (f.ga4ApiSecret.trim()) body.ga4ApiSecret = f.ga4ApiSecret
    const res = await fetch('/api/admin/analytics/conversions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(d.error || 'No se pudo guardar')
    apply(d)
    setSaved(true)
  }
  if (!info) return <Loader2 className="animate-spin text-gray-400" />
  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  const metaOn = Boolean(info.metaPixelId && info.metaTokenSet)
  const gaOn = Boolean(info.ga4MeasurementId && info.ga4ApiSecretSet)
  return (
    <Card title="Conversiones a Meta y Google" subtitle="Solicitud creada = Lead · Reserva completada = Purchase, una vez por evento">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${metaOn ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{metaOn ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Meta {metaOn ? 'conectado' : 'sin conectar'}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${gaOn ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{gaOn ? <CheckCircle2 size={13} /> : <XCircle size={13} />} GA4 {gaOn ? 'conectado' : 'sin conectar'}</span>
      </div>
      {info.stats.rows.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {info.stats.rows.map((r) => <li key={`${r.destination}${r.event}${r.status}`}>{DEST[r.destination] ?? r.destination} · {r.event} · {r.status === 'sent' ? 'enviados' : r.status === 'failed' ? 'fallidos' : r.status}: <strong>{r.count}</strong></li>)}
        </ul>
      )}
      {info.stats.lastFailed && <p className="mt-2 break-words rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">Último error ({DEST[info.stats.lastFailed.destination]}): {info.stats.lastFailed.detail}</p>}
      {!info.canEdit ? <p className="mt-3 text-sm text-amber-700">Solo un superadmin conecta las conversiones.</p> : (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Meta</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-gray-600">
              <li>Administrador de eventos → tu conjunto de datos (píxel) → copia su ID.</li>
              <li>Configuración → API de Conversiones → «Generar token de acceso».</li>
              <li>Para los chats de anuncios de WhatsApp: el ID de la cuenta de WhatsApp Business (Configuración del negocio → Cuentas de WhatsApp).</li>
            </ol>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="ID del píxel / conjunto de datos" value={f.metaPixelId} onChange={(e) => setF({ ...f, metaPixelId: e.target.value })} />
              <input className={inputCls} placeholder={info.metaTokenSet ? 'Token guardado (vacío = conservar)' : 'Token de acceso'} type="password" autoComplete="off" value={f.metaToken} onChange={(e) => setF({ ...f, metaToken: e.target.value })} />
              <input className={inputCls} placeholder="ID de WhatsApp Business (opcional)" value={f.metaWabaId} onChange={(e) => setF({ ...f, metaWabaId: e.target.value })} />
              <input className={inputCls} placeholder="Código de prueba (opcional, TEST…)" value={f.metaTestEventCode} onChange={(e) => setF({ ...f, metaTestEventCode: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Google Analytics 4</p>
            <p className="text-xs text-gray-600">Administrar → Flujos de datos → tu flujo web: copia el «ID de medición» (G-…) y crea un «Secreto de API del Measurement Protocol».</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="ID de medición (G-…)" value={f.ga4MeasurementId} onChange={(e) => setF({ ...f, ga4MeasurementId: e.target.value })} />
              <input className={inputCls} placeholder={info.ga4ApiSecretSet ? 'Secreto guardado (vacío = conservar)' : 'Secreto de API'} type="password" autoComplete="off" value={f.ga4ApiSecret} onChange={(e) => setF({ ...f, ga4ApiSecret: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Los secretos se guardan cifrados y nunca vuelven a mostrarse. Con el código de prueba, los eventos aparecen en «Probar eventos» de Meta; quítalo al terminar.</p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-700">Guardado.</p>}
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />} Guardar</button>
        </div>
      )}
    </Card>
  )
}
