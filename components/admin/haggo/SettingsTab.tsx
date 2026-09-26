'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { CYCLE_OPTIONS, DOMAINS, DOMAIN_LABEL, MODES, MODE_LABEL, NOTICES, NOTICE_LABEL, TRIGGERS, TRIGGER_LABEL, type HaggoConfig, type QuietWindow } from '@/lib/haggo/config'
import { api, btn, btnPrimary, card } from '@/components/admin/haggo/shared'
import { DirectivesSection } from '@/components/admin/haggo/DirectivesSection'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`
const input = 'rounded-xl border border-gray-200 px-3 py-2 text-sm'
const MODE_HINT: Record<string, string> = {
  observer: 'Solo analiza y reporta.',
  copilot: 'Propone y tú apruebas.',
  autonomous: 'Ejecuta lo permitido; lo de riesgo alto siempre lo propone.',
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`${card} space-y-4 p-5`}>
      <div><h2 className="font-semibold text-gray-900">{title}</h2>{hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}</div>
      {children}
    </section>
  )
}

function NumberField({ label, value, onChange, step = 1, min = 0, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; suffix?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <span className="mt-1 flex items-center gap-2"><input type="number" min={min} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${input} w-28`} />{suffix && <span className="text-xs text-gray-500">{suffix}</span>}</span>
    </label>
  )
}

/** Everything about how Haggo works; the base configuration comes preloaded and everything is editable. */
export function SettingsTab({ config, reload }: { config: HaggoConfig; reload: () => void }) {
  const [c, setC] = useState<HaggoConfig>(config)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [catalog, setCatalog] = useState<{ actionsByDomain: Record<string, Array<{ id: string; label: string; risk: string }>>; maxRiskActions: string[] } | null>(null)
  useEffect(() => { api<{ actionsByDomain: Record<string, Array<{ id: string; label: string; risk: string }>>; maxRiskActions: string[] }>('/api/admin/haggo/settings').then(setCatalog).catch(() => null) }, [])
  const set = (patch: Partial<HaggoConfig>) => setC((prev) => ({ ...prev, ...patch }))
  const setWindow = (i: number, patch: Partial<QuietWindow>) => set({ quietHours: c.quietHours.map((w, j) => (j === i ? { ...w, ...patch } : w)) })

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const r = await api<{ config: HaggoConfig }>('/api/admin/haggo/settings', { method: 'PUT', body: JSON.stringify(c) })
      setC(r.config)
      setMsg({ ok: true, text: 'Ajustes guardados. Se aplican en el siguiente tic (máximo 5 minutos).' })
      reload()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Section title="Modo" hint="Cómo actúa Haggo. Puedes darle un modo distinto a cada área. En el dinero nunca actúa solo.">
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button key={m} onClick={() => set({ mode: m })} className={`rounded-xl border p-3 text-left ${c.mode === m ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <span className="block text-sm font-semibold text-gray-900">{MODE_LABEL[m]}</span>
              <span className="block text-xs text-gray-500">{MODE_HINT[m]}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500"><tr className="text-left"><th className="py-1">Área</th><th>Modo</th><th title="Solo cuenta si el área está en Autónomo. Encendido: Haggo también hace solo las acciones de riesgo medio de esa área. Apagado: esas te las propone.">En autónomo, también riesgo medio</th></tr></thead>
            <tbody>
              {DOMAINS.map((d) => (
                <tr key={d} className="border-t border-gray-100">
                  <td className="py-2 pr-3 align-top">
                    <span className="block">{DOMAIN_LABEL[d]}</span>
                    {catalog && <span className="block max-w-xs text-[11px] leading-snug text-gray-500">{catalog.actionsByDomain[d]?.length ? catalog.actionsByDomain[d].map((a) => `${a.label} (${({ low: 'bajo', medium: 'medio', high: 'alto', max: 'máximo' } as Record<string, string>)[a.risk] ?? a.risk})`).join(' · ') : 'Sin acciones todavía'}</span>}
                  </td>
                  <td>
                    <select value={c.domainModes[d] ?? ''} onChange={(e) => set({ domainModes: { ...c.domainModes, [d]: (e.target.value || undefined) as HaggoConfig["mode"] | undefined } })} className={`${input} py-1.5`}>
                      <option value="">Igual que el general ({MODE_LABEL[c.mode]})</option>
                      {MODES.filter((m) => d !== 'money' || m !== 'autonomous').map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                    </select>
                  </td>
                  <td className="align-top">{d === 'money' ? <span className="text-xs text-gray-400">nunca</span> : (
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={Boolean(c.mediumAllowed[d])} disabled={(c.domainModes[d] ?? c.mode) !== 'autonomous'} onChange={(e) => set({ mediumAllowed: { ...c.mediumAllowed, [d]: e.target.checked } })} />
                      {(c.domainModes[d] ?? c.mode) !== 'autonomous' && <span className="text-[11px] text-gray-400">solo en autónomo</span>}
                    </label>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">Cómo decide Haggo si actúa solo en un área en Autónomo</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li><strong>Riesgo bajo</strong> (por ejemplo reprogramar una publicación, reintentar un proveedor de IA, cerrar un incidente): lo hace solo.</li>
            <li><strong>Riesgo medio</strong> (por ejemplo pausar un agente, aprobar una publicación, avisar a socios): lo hace solo <em>solo si marcas «En autónomo, también riesgo medio»</em>; si no, te lo propone.</li>
            <li><strong>Riesgo alto y máximo</strong> (instrucciones de agentes, funciones y botones, socios): siempre te lo propone.</li>
          </ul>
        </div>
        <p className="text-xs text-gray-500">En <strong>autónomo</strong>, Haggo ejecuta solo las acciones de riesgo bajo de esa área (y las de riesgo medio si marcas la casilla), dentro de tus límites y fuera de las horas sin actuar. Lo que pides en la conversación siempre te lo propone. Riesgo alto, riesgo máximo y dinero siempre piden tu aprobación. Después de cada acción, Haggo mide si funcionó; si lo que hizo solo empeoró algo, lo deshace.</p>
      </Section>

      <Section title="Frecuencia" hint="Configuración base: revisión cada 15 min, informe diario a las 7:00, revisión semanal los lunes a las 7:00 y disparadores inmediatos encendidos.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm"><span className="text-gray-700">Revisar cada</span>
            <select value={c.cycleMinutes} onChange={(e) => set({ cycleMinutes: Number(e.target.value) })} className={`${input} mt-1 w-full`}>{CYCLE_OPTIONS.map((m) => <option key={m} value={m}>{m} minutos</option>)}</select>
          </label>
          <label className="block text-sm"><span className="text-gray-700">Informe diario</span>
            <select value={c.dailyReportHour ?? ''} onChange={(e) => set({ dailyReportHour: e.target.value === '' ? null : Number(e.target.value) })} className={`${input} mt-1 w-full`}>
              <option value="">Apagado</option>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="text-gray-700">Revisión semanal</span>
            <select value={c.weeklyReviewDay ?? ''} onChange={(e) => set({ weeklyReviewDay: e.target.value === '' ? null : Number(e.target.value) })} className={`${input} mt-1 w-full`}>
              <option value="">Apagada</option>{DAY_NAMES.map((d, i) => <option key={d} value={i}>Los {d}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="text-gray-700">Hora de la revisión semanal</span>
            <select value={c.weeklyReviewHour} disabled={c.weeklyReviewDay == null} onChange={(e) => set({ weeklyReviewHour: Number(e.target.value) })} className={`${input} mt-1 w-full`}>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm text-gray-700">Despertar a Haggo al momento, sin esperar la revisión, cuando haya:</p>
          <div className="flex flex-wrap gap-4">
            {TRIGGERS.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={c.triggers[t]} onChange={(e) => set({ triggers: { ...c.triggers, [t]: e.target.checked } })} /> {TRIGGER_LABEL[t]}</label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-700">Horas sin actuar solo</p>
          <p className="mb-2 text-xs text-gray-500">En estas franjas observa y propone, pero no ejecuta nada; lo pendiente se ejecuta al terminar. Una franja que pasa la medianoche cuenta desde el día en que empieza. Hora de Bogotá.</p>
          <div className="space-y-2">
            {c.quietHours.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2">
                <div className="flex gap-1">
                  {DAYS.map((d, day) => (
                    <button key={d} onClick={() => setWindow(i, { days: w.days.includes(day) ? w.days.filter((x) => x !== day) : [...w.days, day].sort() })} className={`h-8 w-10 rounded-lg text-xs font-medium ${w.days.includes(day) ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{d}</button>
                  ))}
                </div>
                <span className="text-xs text-gray-500">de</span><input type="time" value={w.from} onChange={(e) => setWindow(i, { from: e.target.value })} className={`${input} py-1`} />
                <span className="text-xs text-gray-500">a</span><input type="time" value={w.to} onChange={(e) => setWindow(i, { to: e.target.value })} className={`${input} py-1`} />
                <button onClick={() => set({ quietHours: c.quietHours.filter((_, j) => j !== i) })} className="ml-auto rounded-lg p-2 text-gray-400 hover:bg-white hover:text-rose-600" title="Quitar"><Trash2 size={15} /></button>
              </div>
            ))}
            <button onClick={() => set({ quietHours: [...c.quietHours, { days: [0, 1, 2, 3, 4, 5, 6], from: '22:00', to: '06:00' }] })} className={btn}><Plus size={14} /> Agregar franja</button>
          </div>
        </div>
      </Section>

      <Section title="Avisos por correo" hint="Cada situación se avisa una sola vez. Necesitan el correo (SendGrid) activo en Mensajería.">
        <label className="block text-sm">
          <span className="text-gray-700">Enviar a</span>
          <input
            defaultValue={c.notifyTo.join(', ')}
            onBlur={(e) => set({ notifyTo: e.target.value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) })}
            placeholder="Vacío = los superadmins de la plataforma"
            className={`${input} mt-1 w-full`}
          />
          <span className="mt-1 block text-xs text-gray-500">{c.notifyTo.length ? `Llegan a: ${c.notifyTo.join(', ')}` : 'Ahora llegan a los superadmins de la plataforma.'} Hasta 10 correos, separados por coma.</span>
        </label>
        <div className="space-y-2">
          {NOTICES.map((n) => (
            <label key={n} className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-0.5" checked={c.notify[n]} onChange={(e) => set({ notify: { ...c.notify, [n]: e.target.checked } })} /> {NOTICE_LABEL[n]}</label>
          ))}
        </div>
      </Section>

      <Section title="Presupuesto y límites" hint="Al llegar al tope, Haggo sigue observando con reglas, sin IA, y te avisa.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Presupuesto mensual" value={c.monthlyBudgetUsd} step={5} onChange={(n) => set({ monthlyBudgetUsd: n })} suffix="USD" />
          <NumberField label="Tope diario" value={c.dailyBudgetUsd} step={0.5} onChange={(n) => set({ dailyBudgetUsd: n })} suffix="USD" />
          <NumberField label="Acciones por ciclo" value={c.maxActionsPerCycle} onChange={(n) => set({ maxActionsPerCycle: n })} />
          <NumberField label="Acciones por día" value={c.maxActionsPerDay} onChange={(n) => set({ maxActionsPerDay: n })} />
          <NumberField label="No tocar lo que una persona cambió hace menos de" value={c.humanCooldownHours} onChange={(n) => set({ humanCooldownHours: n })} suffix="horas" />
          <NumberField label="Esperar antes de repetir una acción sobre lo mismo" value={c.repeatCooldownHours} onChange={(n) => set({ repeatCooldownHours: n })} suffix="horas" />
          <NumberField label="Una propuesta sin decidir caduca a las" value={c.proposalTtlHours} min={1} onChange={(n) => set({ proposalTtlHours: n })} suffix="horas" />
        </div>
        <label className="block max-w-sm text-sm"><span className="text-gray-700">Modelo de IA (opcional)</span>
          <input value={c.model ?? ''} onChange={(e) => set({ model: e.target.value.trim() || null })} placeholder="Vacío = el modelo por defecto de IA · Plataforma" className={`${input} mt-1 w-full`} />
          <span className="mt-1 block text-xs text-gray-500">Si Claude falla, Haggo usa OpenAI como el resto de agentes.</span>
        </label>
      </Section>

      <Section title="Acciones de riesgo máximo" hint="Dinero, borrar datos, claves, seguridad y permisos. Vienen apagadas; solo tú puedes encenderlas una por una y, aun encendidas, siempre piden tu aprobación.">
        {!catalog ? <p className="text-sm text-gray-500">Cargando…</p> : catalog.maxRiskActions.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay acciones de riesgo máximo en el catálogo. Reintentar pagos a socios quedó fuera hasta diseñar bien ese flujo con Mercado Pago. Haggo nunca puede cambiar estos ajustes.</p>
        ) : (
          <div className="space-y-2">
            {catalog.maxRiskActions.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={Boolean(c.maxRiskEnabled[id])} onChange={(e) => {
                  if (e.target.checked && window.prompt('Escribe ENCENDER para permitir que Haggo proponga esta acción de riesgo máximo') !== 'ENCENDER') return
                  set({ maxRiskEnabled: { ...c.maxRiskEnabled, [id]: e.target.checked } })
                }} /> {id}
              </label>
            ))}
            <p className="text-xs text-gray-500">Aun encendidas, siempre piden tu aprobación escribiendo APROBAR.</p>
          </div>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar ajustes</button>
        <button onClick={() => setC(config)} disabled={saving} className={btn}>Descartar cambios</button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</span>}
      </div>

      <DirectivesSection />
    </div>
  )
}
