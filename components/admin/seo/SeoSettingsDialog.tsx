'use client'

import { useMemo, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import { sanitizeSeoConfig, type SeoConfig } from '@/lib/seo/agent/settings-core'
import { WEEK_DAYS, inputCls, seoApi } from './shared'

type Draft = Record<string, unknown>
type Field =
  | { kind: 'bool'; path: string; label: string; help: string; when?: string }
  | { kind: 'num'; path: string; label: string; help: string; unit?: string; decimal?: boolean; when?: string }
  | { kind: 'text'; path: string; label: string; help: string; placeholder?: string; when?: string }
  | { kind: 'day'; path: string; label: string; help: string }
  | { kind: 'list'; path: string; label: string; help: string; placeholder: string; normalize: (s: string) => string }

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '')
const domain = (s: string) => s.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '')
const plain = (s: string) => s.trim()

const GROUPS: Array<{ title: string; fields: Field[] }> = [
  {
    title: 'General',
    fields: [
      { kind: 'bool', path: 'enabled', label: 'Agente encendido', help: 'Si lo apagas, no corre solo cada semana. Los botones manuales siguen funcionando.' },
      { kind: 'day', path: 'weeklyDay', label: 'Día del ciclo semanal', help: 'El día en que el agente hace su revisión completa con IA (hora de Bogotá).' },
      { kind: 'num', path: 'briefsPerCycle', label: 'Briefs por ciclo', unit: 'briefs', help: 'Cuántos planes de artículo escribe en cada ciclo. Cada uno gasta presupuesto (0 a 10).' },
      { kind: 'num', path: 'monthlyBudgetUsd', label: 'Presupuesto mensual de IA', unit: 'US$', decimal: true, help: 'Tope de gasto al mes. Al llegar, el agente sigue con las reglas gratis y deja de escribir.' },
    ],
  },
  {
    title: 'Con marketing',
    fields: [
      { kind: 'bool', path: 'autoSendToMarketing', label: 'Enviar briefs a marketing solo', help: 'Cada brief nuevo pasa solo al calendario del agente de marketing. Apagado: tú pulsas «Enviar a marketing».' },
      { kind: 'bool', path: 'autoAcceptIdeas', label: 'Aceptar las ideas enviadas', help: 'Las ideas entran ya aceptadas. Apagado: quedan como «propuestas» para que alguien las apruebe.' },
    ],
  },
  {
    title: 'Google Search Console',
    fields: [
      { kind: 'bool', path: 'gsc.enabled', label: 'Usar Search Console', help: 'Trae qué busca la gente, clics e impresiones de Google.' },
      { kind: 'text', path: 'gsc.siteUrl', label: 'Propiedad del sitio', when: 'gsc.enabled', placeholder: 'sc-domain:lohaggo.com', help: 'Debe ser igual a la de Search Console: sc-domain:lohaggo.com (todo el dominio) o https://www.lohaggo.com/ (una sola dirección).' },
    ],
  },
  {
    title: 'Revisión de páginas',
    fields: [
      { kind: 'bool', path: 'pageAudit.enabled', label: 'Revisar las páginas del sitio', help: 'Visita las páginas y busca fallas: títulos, descripciones, errores, imágenes sin texto.' },
      { kind: 'num', path: 'pageAudit.maxPages', label: 'Máximo de páginas', when: 'pageAudit.enabled', unit: 'páginas', help: 'Cuántas páginas visita por revisión (5 a 80).' },
    ],
  },
  {
    title: 'Cuándo avisar',
    fields: [
      { kind: 'num', path: 'thresholds.minImpressions', label: 'Impresiones mínimas', unit: 'imp.', help: 'Una búsqueda cuenta solo si apareció al menos tantas veces en Google.' },
      { kind: 'num', path: 'thresholds.lowCtrPct', label: 'Clics bajos', unit: '%', decimal: true, help: 'Si una página en el top 10 recibe menos de este porcentaje de clics, propone cambiar su título y descripción.' },
      { kind: 'num', path: 'thresholds.strikeFrom', label: 'A punto de subir: desde la posición', unit: 'pos.', help: 'Páginas en la segunda hoja de Google que con poco esfuerzo pueden subir. Posición inicial (4 a 30).' },
      { kind: 'num', path: 'thresholds.strikeTo', label: 'A punto de subir: hasta la posición', unit: 'pos.', help: 'Posición final. Debe ser mayor que la inicial.' },
      { kind: 'num', path: 'thresholds.staleArticleDays', label: 'Artículo desactualizado', unit: 'días', help: 'Días sin cambios para proponer actualizar un artículo (30 a 720).' },
      { kind: 'num', path: 'thresholds.thinArticleWords', label: 'Artículo corto', unit: 'palabras', help: 'Un artículo con menos palabras que esto se considera flojo (200 a 2500).' },
      { kind: 'num', path: 'thresholds.zeroResultMinSearches', label: 'Búsquedas sin resultado', unit: 'veces', help: 'Veces que buscan algo en el sitio sin encontrarlo para contarlo como demanda sin atender.' },
    ],
  },
  {
    title: 'Dónde empujar primero',
    fields: [
      { kind: 'list', path: 'focus.services', label: 'Servicios', placeholder: 'plomeria', normalize: slug, help: 'Servicios que quieres priorizar, en minúscula y sin tildes (como en la dirección del sitio). Enter para agregar.' },
      { kind: 'list', path: 'focus.cities', label: 'Ciudades', placeholder: 'bogota', normalize: slug, help: 'Ciudades que quieres priorizar, en minúscula y sin tildes. Enter para agregar.' },
      { kind: 'list', path: 'focus.keywords', label: 'Palabras clave', placeholder: 'plomero a domicilio', normalize: plain, help: 'Búsquedas que te interesa ganar. Enter para agregar.' },
    ],
  },
  {
    title: 'Competidores',
    fields: [
      { kind: 'list', path: 'competitors', label: 'Dominios', placeholder: 'ejemplo.com', normalize: domain, help: 'Sitios a tener en cuenta para buscar otro ángulo, nunca para copiarlos. Solo el dominio (máximo 10).' },
    ],
  },
]

const getAt = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), o)
function setAt<T>(o: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const base = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
  return { ...base, [head]: rest.length ? setAt(base[head], rest.join('.'), value) : value } as T
}

function Chips({ id, values, onChange, placeholder, normalize, describedBy }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; normalize: (s: string) => string; describedBy: string }) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map(normalize).filter(Boolean)
    if (!parts.length) { setText(''); return }
    onChange(Array.from(new Set([...values, ...parts])))
    setText('')
  }
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-sm text-primary-800">
              <span className="break-all">{v}</span>
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Quitar ${v}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary-100"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input id={id} className={inputCls} value={text} placeholder={placeholder} aria-describedby={describedBy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) } }}
          onBlur={() => text.trim() && add(text)} />
        <button type="button" onClick={() => add(text)} disabled={!text.trim()} className="min-h-[44px] shrink-0 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:min-h-[40px]">Agregar</button>
      </div>
    </div>
  )
}

export default function SeoSettingsDialog({ config, defaults, canEdit, onClose, onSaved }: { config: SeoConfig; defaults: SeoConfig; canEdit: boolean; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const { dialogProps, titleId } = useDialog(true, onClose)
  // Numbers stay as typed strings until saved; the sanitizer says what will really be stored
  const [draft, setDraft] = useState<Draft>(() => JSON.parse(JSON.stringify(config)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const clean = useMemo(() => sanitizeSeoConfig(draft), [draft])
  const set = (path: string, v: unknown) => setDraft((d) => setAt(d, path, v))
  const differs = (path: string) => JSON.stringify(getAt(clean, path)) !== JSON.stringify(getAt(defaults, path)) || (typeof getAt(draft, path) === 'string' && getAt(draft, path) !== String(getAt(defaults, path)))

  async function save() {
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await seoApi<{ config: SeoConfig }>('/api/admin/seo/settings', { method: 'PUT', json: { config: draft } })
      setDraft(JSON.parse(JSON.stringify(r.config)))
      setNotice('Guardado. Se aplica desde el próximo ciclo.')
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl focus:outline-none sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-gray-900">Configuración del agente de SEO</h2>
            <p className="mt-0.5 text-xs text-gray-500">{canEdit ? 'Cambia cómo trabaja el agente sin esperar un despliegue.' : 'Solo un superadmin puede cambiarla. Aquí la ves tal como está.'}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 sm:h-9 sm:w-9"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {GROUPS.map((g) => (
            <fieldset key={g.title} className="mb-4 min-w-0 rounded-2xl border p-3" disabled={!canEdit || busy}>
              <legend className="px-1 text-sm font-semibold text-gray-900">{g.title}</legend>
              <div className="space-y-4">
                {g.fields.map((f) => {
                  if ('when' in f && f.when && !getAt(clean, f.when)) return null
                  const id = `seo-set-${f.path}`
                  const help = `${id}-help`
                  const restore = canEdit && differs(f.path) && (
                    <button type="button" onClick={() => set(f.path, JSON.parse(JSON.stringify(getAt(defaults, f.path))))} className="inline-flex min-h-[32px] items-center gap-1 text-xs font-medium text-primary-700 hover:underline"><RotateCcw size={12} /> Restaurar valor por defecto</button>
                  )
                  const helpP = <p id={help} className="mt-0.5 text-xs text-gray-500">{f.help}</p>
                  if (f.kind === 'bool') return (
                    <div key={f.path}>
                      <label className="flex min-h-[44px] items-start gap-3 py-1">
                        <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={Boolean(getAt(clean, f.path))} onChange={(e) => set(f.path, e.target.checked)} aria-describedby={help} />
                        <span className="min-w-0"><span className="block text-sm font-medium text-gray-800">{f.label}</span><span id={help} className="block text-xs text-gray-500">{f.help}</span></span>
                      </label>
                      {restore}
                    </div>
                  )
                  if (f.kind === 'day') return (
                    <div key={f.path}>
                      <label htmlFor={id} className="text-sm font-medium text-gray-800">{f.label}</label>
                      <select id={id} className={`${inputCls} mt-1`} value={String(getAt(clean, f.path))} onChange={(e) => set(f.path, Number(e.target.value))} aria-describedby={help}>
                        {WEEK_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                      </select>
                      {helpP}{restore}
                    </div>
                  )
                  if (f.kind === 'list') return (
                    <div key={f.path}>
                      <label htmlFor={id} className="text-sm font-medium text-gray-800">{f.label}</label>
                      <div className="mt-1"><Chips id={id} values={getAt(clean, f.path) as string[]} onChange={(v) => set(f.path, v)} placeholder={f.placeholder} normalize={f.normalize} describedBy={help} /></div>
                      {helpP}{restore}
                    </div>
                  )
                  if (f.kind === 'text') return (
                    <div key={f.path}>
                      <label htmlFor={id} className="text-sm font-medium text-gray-800">{f.label}</label>
                      <input id={id} className={`${inputCls} mt-1`} value={String(getAt(draft, f.path) ?? '')} placeholder={f.placeholder} onChange={(e) => set(f.path, e.target.value)} aria-describedby={help} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                      {String(getAt(draft, f.path) ?? '').trim() !== String(getAt(clean, f.path)) && <p className="mt-0.5 text-xs font-medium text-amber-700" role="status">No es válida: se guardará {String(getAt(clean, f.path))}.</p>}
                      {helpP}{restore}
                    </div>
                  )
                  const typed = getAt(draft, f.path)
                  const stored = getAt(clean, f.path) as number
                  const typedNum = typed === '' || typed == null ? null : Number(typed)
                  return (
                    <div key={f.path}>
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor={id} className="min-w-0 text-sm font-medium text-gray-800">{f.label}</label>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <input id={id} type="number" step={f.decimal ? 'any' : 1} inputMode={f.decimal ? 'decimal' : 'numeric'} className="min-h-[44px] w-24 rounded-lg border px-2 py-1.5 text-right text-base focus:outline-none focus:ring-1 focus:ring-primary-500 sm:min-h-0 sm:text-sm"
                            value={typed == null ? '' : String(typed)} placeholder={String(getAt(defaults, f.path))} onChange={(e) => set(f.path, e.target.value)} aria-describedby={help} />
                          <span className="w-12 text-xs text-gray-500">{f.unit}</span>
                        </div>
                      </div>
                      {helpP}
                      {typedNum !== null && typedNum !== stored && <p className="mt-0.5 text-xs font-medium text-amber-700" role="status">Fuera de rango: se guardará {stored}{f.unit ? ` ${f.unit}` : ''}.</p>}
                      {restore}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="border-t px-5 py-3" aria-live="polite">
          {error && <p role="alert" className="mb-2 break-words text-sm text-rose-700">{error}</p>}
          {notice && <p className="mb-2 text-sm text-emerald-700">{notice}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {canEdit && <button onClick={() => { setDraft(JSON.parse(JSON.stringify(defaults))); setNotice(null) }} disabled={busy} className="min-h-[44px] rounded-full px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 sm:mr-auto sm:min-h-[40px]">Restaurar todo a los valores por defecto</button>}
            <button onClick={onClose} className="min-h-[44px] rounded-full border px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:min-h-[40px]">Cerrar</button>
            {canEdit && <button onClick={save} disabled={busy} className="min-h-[44px] rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 sm:min-h-[40px]">{busy ? 'Guardando…' : 'Guardar'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
