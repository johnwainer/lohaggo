'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle, AlertCircle, Copy, MapPin, Plus, X } from 'lucide-react'
import { ZONES } from '@/lib/geo/zones'
import { DAY_NAMES, MAX_RANGES_PER_DAY, type ScheduleRange } from '@/lib/partners/coverage-core'

type Range = { startTime: string; endTime: string }
type Week = Record<number, Range[]>

// Monday first, Sunday last
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DEFAULT_RANGE: Range = { startTime: '08:00', endTime: '17:00' }
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const END_TIMES = [...TIMES.slice(1), '23:59']

const emptyWeek = (): Week => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] })

function toWeek(schedule: ScheduleRange[]): Week {
  const week = emptyWeek()
  for (const r of schedule) week[r.dayOfWeek]?.push({ startTime: r.startTime, endTime: r.endTime })
  return week
}

const fromWeek = (week: Week): ScheduleRange[] =>
  DAY_ORDER.flatMap((d) => week[d].map((r) => ({ dayOfWeek: d, ...r })))

const label = (t: string) => (t === '23:59' ? '24:00' : t)

export default function CoverageEditor() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [zones, setZones] = useState<string[]>([])
  const [week, setWeek] = useState<Week>(emptyWeek)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/partner/coverage')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data: { zones: string[]; schedule: ScheduleRange[] }) => {
        setZones(data.zones ?? [])
        setWeek(toWeek(data.schedule ?? []))
      })
      .catch(() => setStatus({ type: 'error', text: 'No pudimos cargar tus zonas y horario' }))
      .finally(() => setLoading(false))
  }, [])

  const comunas = useMemo(() => ZONES.filter((z) => z.kind === 'comuna'), [])
  const municipios = useMemo(() => ZONES.filter((z) => z.kind === 'municipio'), [])

  const invalidDay = DAY_ORDER.find((d) => week[d].some((r) => r.startTime >= r.endTime))

  const toggleZone = (key: string) => {
    setStatus(null)
    setZones((z) => (z.includes(key) ? z.filter((k) => k !== key) : [...z, key]))
  }

  const updateDay = (day: number, ranges: Range[]) => {
    setStatus(null)
    setWeek((w) => ({ ...w, [day]: ranges }))
  }

  const copyToAll = (day: number) => {
    setStatus(null)
    setWeek((w) => {
      const next = emptyWeek()
      for (const d of DAY_ORDER) next[d] = w[day].map((r) => ({ ...r }))
      return next
    })
  }

  const save = async () => {
    if (invalidDay !== undefined) {
      setStatus({ type: 'error', text: `Revisa el ${DAY_NAMES[invalidDay].toLowerCase()}: la hora de inicio debe ser antes de la de fin` })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/partner/coverage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones, schedule: fromWeek(week) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setZones(data.zones ?? [])
      setWeek(toWeek(data.schedule ?? []))
      setStatus({ type: 'success', text: 'Zonas y horario guardados' })
    } catch (e) {
      setStatus({ type: 'error', text: e instanceof Error ? e.message : 'No se pudo guardar' })
    } finally {
      setSaving(false)
    }
  }

  const chip = (z: { key: string; name: string }) => {
    const on = zones.includes(z.key)
    return (
      <button
        key={z.key}
        type="button"
        aria-pressed={on}
        onClick={() => toggleZone(z.key)}
        className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
          on ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
        }`}
      >
        {z.name}
      </button>
    )
  }

  return (
    <section id="zonas-y-horario" aria-labelledby="coverage-title" className="mb-8 scroll-mt-20">
      <h2 id="coverage-title" className="text-xl font-semibold text-gray-900 mb-1">Zonas y horario</h2>
      <p className="text-sm text-gray-600 mb-4">Te avisamos primero de las solicitudes en tus zonas y dentro de tu horario.</p>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-gray-600" aria-busy="true">Cargando…</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={18} className="text-primary-600" aria-hidden />
              <h3 className="font-bold text-gray-900">Zonas donde trabajas</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Sin zonas marcadas = atiendes toda la ciudad.
              {zones.length > 0 && <> · <span className="font-semibold text-primary-700">{zones.length} marcada{zones.length === 1 ? '' : 's'}</span></>}
            </p>

            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Medellín (comunas)</p>
            <div className="flex flex-wrap gap-2 mb-4">{comunas.map(chip)}</div>

            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Área metropolitana</p>
            <div className="flex flex-wrap gap-2">{municipios.map(chip)}</div>

            {zones.length > 0 && (
              <button type="button" onClick={() => { setStatus(null); setZones([]) }} className="mt-4 min-h-[44px] rounded-full px-1 text-sm font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                Quitar todas (toda la ciudad)
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock size={18} className="text-secondary-600" aria-hidden />
              <h3 className="font-bold text-gray-900">Horario semanal</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">Sin días activos = te llegan solicitudes a cualquier hora.</p>

            <ul className="divide-y divide-gray-100">
              {DAY_ORDER.map((d) => {
                const ranges = week[d]
                const on = ranges.length > 0
                const dayName = DAY_NAMES[d]
                return (
                  <li key={d} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span id={`day-${d}`} className={`font-semibold ${on ? 'text-gray-900' : 'text-gray-600'}`}>{dayName}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-labelledby={`day-${d}`}
                        onClick={() => updateDay(d, on ? [] : [{ ...DEFAULT_RANGE }])}
                        className="relative inline-flex h-11 w-14 flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                      >
                        <span aria-hidden className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${on ? 'bg-primary-600' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                        </span>
                      </button>
                    </div>

                    {on && (
                      <div className="mt-2 space-y-2">
                        {ranges.map((r, i) => {
                          const bad = r.startTime >= r.endTime
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <label className="sr-only" htmlFor={`from-${d}-${i}`}>{`${dayName} desde`}</label>
                              <select
                                id={`from-${d}-${i}`}
                                value={r.startTime}
                                onChange={(e) => updateDay(d, ranges.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))}
                                className={`flex-1 min-w-0 h-11 rounded-xl border bg-gray-50 px-2 text-sm font-medium text-gray-900 ${bad ? 'border-red-300' : 'border-gray-200'}`}
                              >
                                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <span className="text-gray-600 text-sm" aria-hidden>a</span>
                              <label className="sr-only" htmlFor={`to-${d}-${i}`}>{`${dayName} hasta`}</label>
                              <select
                                id={`to-${d}-${i}`}
                                value={r.endTime}
                                onChange={(e) => updateDay(d, ranges.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))}
                                className={`flex-1 min-w-0 h-11 rounded-xl border bg-gray-50 px-2 text-sm font-medium text-gray-900 ${bad ? 'border-red-300' : 'border-gray-200'}`}
                              >
                                {END_TIMES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                              </select>
                              {ranges.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Quitar franja ${i + 1} del ${dayName.toLowerCase()}`}
                                  onClick={() => updateDay(d, ranges.filter((_, j) => j !== i))}
                                  className="h-11 w-11 flex-shrink-0 inline-flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                  <X size={16} aria-hidden />
                                </button>
                              )}
                            </div>
                          )
                        })}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                          {ranges.length < MAX_RANGES_PER_DAY && (
                            <button
                              type="button"
                              onClick={() => {
                                // Two hours right after the last range (or the evening when it ends late)
                                const idx = TIMES.indexOf(ranges[ranges.length - 1].endTime)
                                const from = idx >= 0 && idx + 4 < TIMES.length ? idx : TIMES.indexOf('18:00')
                                updateDay(d, [...ranges, { startTime: TIMES[from], endTime: TIMES[from + 4] }])
                              }}
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-1 text-xs font-semibold text-primary-700 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                              <Plus size={14} aria-hidden /> Otra franja
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => copyToAll(d)}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-1 text-xs font-semibold text-secondary-700 hover:text-secondary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          >
                            <Copy size={14} aria-hidden /> Copiar a todos los días
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {status && (
            <div role="status" className={`p-3 rounded-2xl flex items-center gap-2 text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {status.type === 'success' ? <CheckCircle size={18} aria-hidden /> : <AlertCircle size={18} aria-hidden />}
              <span>{status.text}</span>
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto px-8 h-12 rounded-full bg-primary-600 text-white font-bold hover:bg-primary-700 disabled:opacity-60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {saving ? 'Guardando…' : 'Guardar zonas y horario'}
          </button>
        </div>
      )}
    </section>
  )
}
