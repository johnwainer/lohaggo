'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Pause, Play, RefreshCw } from 'lucide-react'
import {
  CONVERSION_KEYS, CONVERSION_LABEL, DEFAULT_REACTIVATION_CONFIG, pct, sanitizeReactivationConfig,
  type GroupStats, type ReactivationConfig,
} from '@/lib/partners/reactivation-core'

type Field =
  | { kind: 'bool'; path: string; label: string; help: string }
  | { kind: 'int'; path: string; label: string; help: string; unit: string }

const GROUPS: Array<{ title: string; fields: Field[] }> = [
  {
    title: 'General',
    fields: [
      { kind: 'bool', path: 'enabled', label: 'Campaña encendida', help: 'Apagada no inscribe ni envía nada; el reporte sigue disponible.' },
      { kind: 'bool', path: 'segments.A', label: 'Segmento A', help: 'Sin documentos ni servicios: «te falta un paso» con el enfoque de elegir servicios.' },
      { kind: 'bool', path: 'segments.B', label: 'Segmento B', help: 'Sin documentos pero con servicios: «te falta un paso».' },
      { kind: 'bool', path: 'segments.F', label: 'Segmento F', help: 'Verificados que nunca enviaron una propuesta: «ya estás verificado».' },
      { kind: 'bool', path: 'segments.H', label: 'Segmento H', help: 'Verificados sin propuestas en 30 días.' },
      { kind: 'int', path: 'controlPct', label: 'Grupo de control', unit: '%', help: 'Socios que nunca reciben nada (fijo por socio). Sirve para medir el efecto real (0–50).' },
    ],
  },
  {
    title: 'Ritmo',
    fields: [
      { kind: 'int', path: 'dailyLimit', label: 'Máximo por día', unit: 'msj', help: 'WhatsApp + SMS por día de Bogotá; también tope de socios nuevos por día.' },
      { kind: 'int', path: 'perRunLimit', label: 'Máximo por corrida', unit: 'msj', help: 'Por cada corrida horaria (WhatsApp + SMS e inscripciones).' },
      { kind: 'int', path: 'startHour', label: 'Desde las', unit: 'h', help: 'Hora de Bogotá, lunes a sábado (6–20).' },
      { kind: 'int', path: 'endHour', label: 'Hasta las', unit: 'h', help: 'Hora de Bogotá en que deja de enviar (mayor que la de inicio, máximo 21).' },
      { kind: 'int', path: 'maxMarketingWaPer14Days', label: 'Tope de marketing', unit: 'WA', help: 'WhatsApp de marketing por socio en 14 días (todas las plantillas). Al llegar, el paso espera.' },
      { kind: 'int', path: 'waitForApprovalDays', label: 'Esperar aprobación de Meta', unit: 'días', help: 'Si la plantilla nueva no está aprobada, el paso espera esto y luego usa la de respaldo.' },
      { kind: 'int', path: 'resumeAfterSilentDays', label: 'Retomar tras silencio', unit: 'días', help: 'Si el socio nos escribe, su secuencia se pausa (lo atiende el bot) y retoma tras estos días sin escribir.' },
    ],
  },
  {
    title: 'Días de cada paso (A y B)',
    fields: [
      { kind: 'int', path: 'days.docsWa', label: 'WhatsApp «te falta un paso»', unit: 'día', help: 'C46 (respaldo: C3). Día 0 = al inscribirse.' },
      { kind: 'int', path: 'days.docsEmail', label: 'Correo con los 3 pasos', unit: 'día', help: 'Solo a correos reales; no espera aprobaciones.' },
      { kind: 'int', path: 'days.guideWa', label: 'WhatsApp guía de antecedentes', unit: 'día', help: 'C47 (sin respaldo: si no se aprueba, se salta).' },
      { kind: 'int', path: 'days.sms', label: 'SMS', unit: 'día', help: 'Un SMS corto con el enlace de verificación.' },
      { kind: 'int', path: 'days.lastWa', label: 'WhatsApp último aviso', unit: 'día', help: 'C48 (respaldo: C3).' },
    ],
  },
  {
    title: 'Días de cada paso (F y H)',
    fields: [
      { kind: 'int', path: 'days.activateWa', label: 'WhatsApp «ya estás verificado»', unit: 'día', help: 'C49 (respaldo: C33 compartir perfil).' },
      { kind: 'int', path: 'days.demandWa', label: 'WhatsApp «hay demanda»', unit: 'día', help: 'C29, solo si hay solicitudes reales recientes de sus servicios en su ciudad.' },
      { kind: 'int', path: 'days.tipsEmail', label: 'Correo de consejos (solo F)', unit: 'día', help: 'Cómo ganar la primera reserva.' },
      { kind: 'int', path: 'demandLookbackDays', label: 'Demanda reciente', unit: 'días', help: 'Ventana de solicitudes que cuenta como demanda real para C29.' },
    ],
  },
  {
    title: 'Canales y revisión',
    fields: [
      { kind: 'bool', path: 'smsEnabled', label: 'Enviar SMS', help: 'Apagado, el paso de SMS se salta.' },
      { kind: 'bool', path: 'emailEnabled', label: 'Enviar correos', help: 'Apagado, los pasos de correo se saltan.' },
      { kind: 'int', path: 'reviewSlaHours', label: 'Revisar documentos en', unit: 'h', help: 'Un documento pendiente más tiempo abre un incidente y avisa a los admins.' },
      { kind: 'int', path: 'conversionWindowDays', label: 'Ventana de conversión', unit: 'días', help: 'Días tras la inscripción que cuentan en el reporte.' },
    ],
  },
]

function getAt(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o)
}
function setAt<T>(o: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const root = structuredClone(o) as Record<string, unknown>
  let cur = root
  for (const k of keys.slice(0, -1)) {
    cur[k] = { ...((cur[k] as Record<string, unknown>) ?? {}) }
    cur = cur[k] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
  return root as T
}

type Preview = {
  window: { open: boolean; sentToday: number; enrolledToday: number; dailyLimit: number; perRunLimit: number }
  registryAvailable: boolean
  templates: Array<{ code: string; name: string; approved: boolean }>
  segments: Record<string, { label: string; partners: number; enrolled: number; control: number }>
  actions: Array<{ key: string; label: string; count: number }>
  upcoming: Array<{ userId: string; name: string; segment: string; action: string; detail: string }>
  nextScheduled: Array<{ userId: string; name: string; segment: string; action: string; detail: string }>
  followups: Array<{ userId: string; name: string; segment: string; action: string; detail: string }>
}

type Report = {
  windowDays: number
  segments: Array<{ segment: string; label: string; eligible: number; enrolled: number; control: number; treatment: GroupStats; controlStats: GroupStats }>
  sends: Array<{ segment: string; step: string; label: string; channel: string; template: string; sent: number; skipped: number }>
  exits: Array<{ reason: string; label: string; count: number }>
}

const card = 'rounded-2xl border bg-white p-4'
const fmtDate = (iso: string) => {
  const d = new Date(iso.replace(/^desde /, ''))
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function PartnerReactivationPanel() {
  const [config, setConfig] = useState<ReactivationConfig | null>(null)
  const [draft, setDraft] = useState<ReactivationConfig | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedByEmail: string | null }>({ updatedAt: null, updatedByEmail: null })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState({ config: true, preview: true, report: true })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const loadConfig = useCallback(async () => {
    setLoading((l) => ({ ...l, config: true }))
    const res = await fetch('/api/admin/partners/reactivation', { cache: 'no-store' }).catch(() => null)
    const data = res?.ok ? await res.json() : null
    if (data) {
      setConfig(data.config)
      setDraft(data.config)
      setCanEdit(Boolean(data.canEdit))
      setMeta({ updatedAt: data.updatedAt, updatedByEmail: data.updatedByEmail })
    }
    setLoading((l) => ({ ...l, config: false }))
  }, [])
  const loadPreview = useCallback(async () => {
    setLoading((l) => ({ ...l, preview: true }))
    const res = await fetch('/api/admin/partners/reactivation/preview', { cache: 'no-store' }).catch(() => null)
    setPreview(res?.ok ? await res.json() : null)
    setLoading((l) => ({ ...l, preview: false }))
  }, [])
  const loadReport = useCallback(async () => {
    setLoading((l) => ({ ...l, report: true }))
    const res = await fetch('/api/admin/partners/reactivation/report', { cache: 'no-store' }).catch(() => null)
    setReport(res?.ok ? await res.json() : null)
    setLoading((l) => ({ ...l, report: false }))
  }, [])

  useEffect(() => { void loadConfig(); void loadPreview(); void loadReport() }, [loadConfig, loadPreview, loadReport])

  const send = async (method: 'PUT' | 'PATCH', body: unknown) => {
    setSaving(true)
    setFeedback(null)
    const res = await fetch('/api/admin/partners/reactivation', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (!res?.ok) { setFeedback({ type: 'error', text: data.error || 'No se pudo guardar' }); return }
    setConfig(data.config)
    setDraft(data.config)
    setFeedback({ type: 'ok', text: 'Guardado. Aplica desde la próxima corrida (cada hora).' })
    void loadPreview()
  }

  const dirty = Boolean(config && draft && JSON.stringify(sanitizeReactivationConfig(draft)) !== JSON.stringify(config))
  const status = !config ? null : !config.enabled ? { text: 'Apagada', cls: 'bg-gray-100 text-gray-700' } : config.paused ? { text: 'En pausa', cls: 'bg-amber-100 text-amber-800' } : { text: 'Enviando', cls: 'bg-emerald-100 text-emerald-800' }

  return (
    <section className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Reactivación de socios</h2>
            <p className="text-sm text-gray-600">Secuencias por WhatsApp, correo y SMS para socios que no terminaron su registro o no han enviado propuestas. Corre cada hora, lunes a sábado.</p>
          </div>
          {status && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.text}</span>}
        </div>
        {config && canEdit && config.enabled && (
          <button
            type="button"
            disabled={saving}
            onClick={() => send('PATCH', { paused: !config.paused })}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold sm:w-auto ${config.paused ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'} disabled:opacity-60`}
          >
            {config.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {config.paused ? 'Reanudar envíos' : 'Pausar envíos'}
          </button>
        )}
        {meta.updatedAt && <p className="text-xs text-gray-500">Última edición: {fmtDate(meta.updatedAt)}{meta.updatedByEmail ? ` · ${meta.updatedByEmail}` : ''}</p>}
        {!meta.updatedAt && !loading.config && <p className="text-xs text-gray-500">Usando los valores por defecto.</p>}
        {feedback && <p className={`text-sm ${feedback.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{feedback.text}</p>}
      </div>

      {/* Preview */}
      <div className={`${card} space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Qué pasa ahora</h3>
          <button type="button" onClick={() => void loadPreview()} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium text-gray-700">
            <RefreshCw className={`h-3.5 w-3.5 ${loading.preview ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
        {loading.preview && !preview ? <p className="text-sm text-gray-500">Calculando…</p> : !preview ? <p className="text-sm text-red-600">No se pudo calcular la vista previa.</p> : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Ventana de envío" value={preview.window.open ? 'Abierta' : 'Cerrada'} />
              <Stat label="Enviados hoy" value={`${preview.window.sentToday} / ${preview.window.dailyLimit}`} />
              <Stat label="Inscritos hoy" value={String(preview.window.enrolledToday)} />
              <Stat label="Por corrida" value={String(preview.window.perRunLimit)} />
            </div>
            {!preview.registryAvailable && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">No se pudo leer el estado de las plantillas en Twilio: no se envía WhatsApp hasta que vuelva.</p>}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Plantillas</p>
              <div className="flex flex-wrap gap-2">
                {preview.templates.map((t) => (
                  <span key={t.code} title={t.name} className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                    {t.code} {t.approved ? 'aprobada' : 'en revisión'}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Segmentos</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(preview.segments).map(([seg, s]) => (
                  <div key={seg} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-900">{seg} · {s.label}</p>
                    <p className="text-xs text-gray-600">{s.partners} socios ahora{s.enrolled || s.control ? ` · ${s.enrolled} en campaña · ${s.control} control` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Próxima acción por socio</p>
              <ul className="space-y-1.5">
                {preview.actions.map((a) => (
                  <li key={a.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 text-gray-700">{a.label}</span>
                    <span className="shrink-0 font-semibold text-gray-900">{a.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <PeopleList title="Lo siguiente que se hace (si la ventana y los topes lo permiten)" rows={preview.upcoming} empty="Nada pendiente ahora." />
            <PeopleList title="Próximos pasos programados" rows={preview.nextScheduled.map((r) => ({ ...r, detail: fmtDate(r.detail) }))} empty="Ninguno." />
            <PeopleList title="Para una persona (documentos incompletos o rechazados)" rows={preview.followups} empty="Nadie por ahora." />
          </>
        )}
      </div>

      {/* Report */}
      <div className={`${card} space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Resultados</h3>
          <button type="button" onClick={() => void loadReport()} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium text-gray-700">
            <RefreshCw className={`h-3.5 w-3.5 ${loading.report ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
        {loading.report && !report ? <p className="text-sm text-gray-500">Calculando…</p> : !report ? <p className="text-sm text-red-600">No se pudo calcular el reporte.</p> : (
          <>
            <p className="text-xs text-gray-500">Conversiones dentro de {report.windowDays} días desde la inscripción. Campaña = recibió mensajes; control = no recibió nada.</p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {report.segments.map((s) => (
                <div key={s.segment} className="rounded-xl bg-gray-50 p-3 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.segment} · {s.label}</p>
                    <p className="text-xs text-gray-600">{s.eligible} por inscribir · {s.enrolled} en campaña · {s.control} control</p>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs">
                    <span className="text-gray-500" />
                    <span className="text-right font-semibold text-gray-700">Campaña</span>
                    <span className="text-right font-semibold text-gray-700">Control</span>
                    {CONVERSION_KEYS.map((k) => (
                      <Row key={k} label={CONVERSION_LABEL[k]} a={s.treatment[k]} an={s.treatment.n} b={s.controlStats[k]} bn={s.controlStats.n} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Envíos por paso</p>
              {!report.sends.length ? <p className="text-sm text-gray-500">Aún no hay envíos.</p> : (
                <ul className="space-y-1.5">
                  {report.sends.map((r) => (
                    <li key={`${r.segment}-${r.step}-${r.template}`} className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0 text-gray-700">{r.segment} · {r.label}{r.template && r.template !== r.step ? ` (${r.template})` : ''}</span>
                      <span className="shrink-0 text-gray-900"><strong>{r.sent}</strong>{r.skipped ? <span className="text-gray-500"> · {r.skipped} saltados</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {report.exits.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Salidas de la campaña</p>
                <ul className="space-y-1.5">
                  {report.exits.map((e) => (
                    <li key={e.reason} className="flex items-start justify-between gap-3 text-sm"><span className="text-gray-700">{e.label}</span><strong className="text-gray-900">{e.count}</strong></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Config */}
      <div className={`${card} space-y-4`}>
        <div>
          <h3 className="font-semibold text-gray-900">Configuración</h3>
          {!canEdit && <p className="text-xs text-gray-500">Solo un superadmin puede cambiarla.</p>}
        </div>
        {!draft ? <p className="text-sm text-gray-500">Cargando…</p> : (
          <>
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="space-y-2" disabled={!canEdit || saving}>
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.title}</legend>
                {g.fields.map((f) => {
                  const value = getAt(draft, f.path)
                  const def = getAt(DEFAULT_REACTIVATION_CONFIG, f.path)
                  return (
                    <label key={f.path} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{f.label}</span>
                        <span className="block text-xs text-gray-500">{f.help}{def !== undefined ? ` Por defecto: ${typeof def === 'boolean' ? (def ? 'sí' : 'no') : def}.` : ''}</span>
                      </span>
                      {f.kind === 'bool' ? (
                        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-primary-600" checked={Boolean(value)} onChange={(e) => setDraft((d) => d && setAt(d, f.path, e.target.checked))} />
                      ) : (
                        <span className="flex shrink-0 items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            className="w-16 rounded-lg border px-2 py-1 text-right text-sm"
                            value={String(value ?? '')}
                            onChange={(e) => setDraft((d) => d && setAt(d, f.path, e.target.value === '' ? '' : Number(e.target.value)))}
                          />
                          <span className="w-8 text-xs text-gray-500">{f.unit}</span>
                        </span>
                      )}
                    </label>
                  )
                })}
              </fieldset>
            ))}
            {canEdit && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={!dirty || saving} onClick={() => send('PUT', { config: draft })} className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" disabled={!dirty || saving} onClick={() => setDraft(config)} className="rounded-full border px-5 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">Descartar</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function Row({ label, a, an, b, bn }: { label: string; a: number; an: number; b: number; bn: number }) {
  return (
    <>
      <span className="text-gray-700">{label}</span>
      <span className="text-right text-gray-900">{a} <span className="text-gray-500">({pct(a, an)} %)</span></span>
      <span className="text-right text-gray-900">{b} <span className="text-gray-500">({pct(b, bn)} %)</span></span>
    </>
  )
}

function PeopleList({ title, rows, empty }: { title: string; rows: Array<{ userId: string; name: string; segment: string; action: string; detail: string }>; empty: string }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 8)
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title} {rows.length ? `(${rows.length})` : ''}</p>
      {!rows.length ? <p className="text-sm text-gray-500">{empty}</p> : (
        <ul className="divide-y rounded-xl border">
          {shown.map((r, i) => (
            <li key={`${r.userId}-${i}`} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/users/${r.userId}`} className="min-w-0 truncate text-sm font-medium text-primary-700 hover:underline">{r.name}</Link>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{r.segment}</span>
              </div>
              <p className="text-xs text-gray-600">{r.action}{r.detail ? ` · ${r.detail}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-semibold text-primary-700">{all ? 'Ver menos' : `Ver los ${rows.length}`}</button>
      )}
    </div>
  )
}
