'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import { DEFAULT_INBOX_CONFIG, sanitizeInboxConfig, type InboxConfig } from '@/lib/inbox/settings-core'
import type { WaitingRule } from '@/lib/inbox/waiting'

type Field =
  | { kind: 'bool'; path: string; label: string; help: string }
  | { kind: 'int'; path: string; label: string; help: string; unit: string; when?: string }

type Group = { title: string; fields: Field[] }

const GROUPS: Group[] = [
  {
    title: 'Escalamiento',
    fields: [
      { kind: 'int', path: 'escalation.notifyMinutes', label: 'Aviso', unit: 'min', help: 'Avisa a quien tiene la conversación (o a todos) si nadie respondió.' },
      { kind: 'int', path: 'escalation.escalateMinutes', label: 'Escalar', unit: 'min', help: 'Avisa a todo el equipo y abre un incidente alto.' },
      { kind: 'int', path: 'escalation.criticalMinutes', label: 'Crítico', unit: 'min', help: 'Incidente crítico por WhatsApp a los admins. En la lista sale en rojo fuerte.' },
      { kind: 'bool', path: 'escalation.holdingEnabled', label: 'Mensaje de espera', help: 'La IA le dice al cliente que una persona le responderá y qué puede hacer mientras.' },
      { kind: 'int', path: 'escalation.holdingMinutes', label: 'Mensaje de espera a los', unit: 'min', when: 'escalation.holdingEnabled', help: 'Minutos de espera antes de enviarlo (una vez por día como máximo).' },
      { kind: 'bool', path: 'escalation.staleSweepEnabled', label: 'Revisión diaria de leads', help: 'Cada mañana devuelve a «Por responder» los leads a los que nadie contestó.' },
      { kind: 'int', path: 'escalation.staleAfterHours', label: 'Lead sin respuesta tras', unit: 'h', when: 'escalation.staleSweepEnabled', help: 'Horas desde el último mensaje del cliente para contarlo como lead sin respuesta.' },
    ],
  },
  {
    title: 'Horario del equipo',
    fields: [
      { kind: 'int', path: 'escalation.teamOpenHour', label: 'Abre a las', unit: 'h', help: 'Hora de Bogotá (0–23). Fuera de horario no hay WhatsApp al equipo ni rojo en la lista.' },
      { kind: 'int', path: 'escalation.teamCloseHour', label: 'Cierra a las', unit: 'h', help: 'Hora de Bogotá (1–24); debe ser mayor que la de apertura.' },
    ],
  },
  {
    title: 'Vencido',
    fields: [
      { kind: 'int', path: 'overdueMinutes', label: 'Vencido tras', unit: 'min', help: 'Espera en horario del equipo que pone la conversación en rojo en la lista.' },
    ],
  },
  {
    title: 'Cierre automático',
    fields: [
      { kind: 'bool', path: 'autoClose.enabled', label: 'Cerrar por inactividad', help: 'Cierra las conversaciones de la IA cuando el cliente deja de responder.' },
      { kind: 'int', path: 'autoClose.inactivityHours', label: 'Cerrar tras', unit: 'h', when: 'autoClose.enabled', help: 'Horas sin respuesta del cliente al último mensaje de la IA.' },
    ],
  },
  {
    title: 'Encuesta de satisfacción',
    fields: [
      { kind: 'bool', path: 'csat.enabled', label: 'Enviar encuesta', help: 'Pregunta del 1 al 5 al cerrar una conversación como gestionada.' },
      { kind: 'int', path: 'csat.cooldownDays', label: 'Máximo una cada', unit: 'días', when: 'csat.enabled', help: 'A un mismo contacto no se le vuelve a preguntar antes.' },
    ],
  },
  {
    title: 'Fallas de la IA',
    fields: [
      { kind: 'bool', path: 'aiFailure.backToQueue', label: 'Volver a «Por responder»', help: 'Si la IA falla al responder, la conversación pasa a una persona y entra al escalamiento.' },
      { kind: 'bool', path: 'aiFailure.incident', label: 'Incidente crítico', help: 'Abre o suma al incidente «la IA no puede responder» (aviso por WhatsApp).' },
    ],
  },
  {
    title: 'Visión',
    fields: [
      { kind: 'bool', path: 'vision.enabled', label: 'La IA mira las fotos', help: 'Describe el trabajo a partir de las fotos que manda el cliente.' },
      { kind: 'int', path: 'vision.maxImages', label: 'Máximo de fotos', unit: 'fotos', when: 'vision.enabled', help: 'Fotos que la IA mira por turno (1–8).' },
    ],
  },
  {
    title: 'Recordatorio a medio pedido',
    fields: [
      { kind: 'bool', path: 'funnel.nudgeEnabled', label: 'Enviar recordatorio', help: 'Un solo mensaje a quien dejó una solicitud a medias.' },
      { kind: 'int', path: 'funnel.nudgeAfterHours', label: 'Recordar tras', unit: 'h', when: 'funnel.nudgeEnabled', help: 'Horas desde que dejó de responder (1–48).' },
    ],
  },
]

const LABEL_BY_PATH = new Map(GROUPS.flatMap((g) => g.fields.map((f) => [f.path, f.label] as const)))

function getAt(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o)
}

function setAt<T>(o: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const base = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
  return { ...base, [head]: rest.length ? setAt(base[head], rest.join('.'), value) : value } as T
}

/** Superadmin: what the inbox does on its own (ladder, overdue, closing, survey, AI failures, vision, reminders). */
export default function InboxSettingsDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: (rule: WaitingRule) => void }) {
  const { dialogProps, titleId } = useDialog(open, onClose)
  // Number inputs keep what is typed (strings) until saved; the sanitizer says what will be stored
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(null); setError(null); setNotice(null); setBusy(true)
    fetch('/api/admin/inbox/settings')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `No se pudo cargar (HTTP ${r.status})`)
        setDraft(d.config as Record<string, unknown>)
        setCanEdit(Boolean(d.canEdit))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))
      .finally(() => setBusy(false))
  }, [open])

  const clean = useMemo<InboxConfig | null>(() => (draft ? sanitizeInboxConfig(draft) : null), [draft])

  async function save() {
    if (!draft) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await fetch('/api/admin/inbox/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: draft }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `No se pudo guardar (HTTP ${r.status})`)
      setDraft(d.config)
      const adjusted = Array.isArray(d.adjusted) ? (d.adjusted as string[]).map((p) => LABEL_BY_PATH.get(p) ?? p) : []
      setNotice(adjusted.length ? `Guardado. Ajustamos al rango permitido: ${adjusted.join(', ')}.` : 'Guardado. Se aplica en menos de un minuto.')
      if (d.waitingRule) onSaved?.(d.waitingRule as WaitingRule)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative flex w-full sm:max-w-lg max-h-[90vh] flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-3 border-b px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-gray-900">Configuración de la bandeja</h2>
            <p className="mt-0.5 text-xs text-gray-500">{canEdit ? 'Cambia los tiempos sin desplegar. Vacío = valor por defecto.' : 'Solo un superadmin puede cambiarla.'}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {busy && !draft && <p className="py-6 text-center text-sm text-gray-500">Cargando…</p>}
          {draft && clean && GROUPS.map((g) => (
            <fieldset key={g.title} className="mb-4 rounded-2xl border p-3" disabled={!canEdit || busy}>
              <legend className="px-1 text-sm font-semibold text-gray-900">{g.title}</legend>
              <div className="space-y-3">
                {g.fields.map((f) => {
                  if (f.kind === 'bool') {
                    const checked = Boolean(getAt(clean, f.path))
                    return (
                      <label key={f.path} className="flex items-start gap-3">
                        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} onChange={(e) => setDraft((d) => setAt(d, f.path, e.target.checked))} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-800">{f.label}</span>
                          <span className="block text-xs text-gray-500">{f.help}</span>
                        </span>
                      </label>
                    )
                  }
                  if (f.when && !getAt(clean, f.when)) return null
                  const typed = getAt(draft, f.path)
                  const stored = getAt(clean, f.path) as number
                  const def = getAt(DEFAULT_INBOX_CONFIG, f.path) as number
                  const typedNum = typed === '' || typed === undefined || typed === null ? null : Number(typed)
                  const changed = typedNum !== null && typedNum !== stored
                  const id = `inbox-setting-${f.path}`
                  return (
                    <div key={f.path}>
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor={id} className="min-w-0 text-sm font-medium text-gray-800">{f.label}</label>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <input
                            id={id}
                            type="number"
                            inputMode="numeric"
                            className="w-20 rounded-lg border px-2 py-1.5 text-right text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            value={typed === undefined || typed === null ? '' : String(typed)}
                            placeholder={String(def)}
                            onChange={(e) => setDraft((d) => setAt(d, f.path, e.target.value))}
                            aria-describedby={`${id}-help`}
                          />
                          <span className="w-9 text-xs text-gray-500">{f.unit}</span>
                        </div>
                      </div>
                      <p id={`${id}-help`} className="mt-0.5 text-xs text-gray-500">{f.help}</p>
                      {changed && <p className="mt-0.5 text-xs font-medium text-amber-700" role="status">Fuera de rango: se guardará {stored} {f.unit}.</p>}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="border-t px-5 py-3" aria-live="polite">
          {error && <p role="alert" className="mb-2 text-sm text-rose-700">{error}</p>}
          {notice && <p className="mb-2 text-sm text-emerald-700">{notice}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {canEdit && draft && (
              <button onClick={() => setDraft({ ...DEFAULT_INBOX_CONFIG } as unknown as Record<string, unknown>)} disabled={busy} className="rounded-full px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 sm:mr-auto">
                Valores por defecto
              </button>
            )}
            <button onClick={onClose} className="rounded-full border px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cerrar</button>
            {canEdit && draft && (
              <button onClick={save} disabled={busy} className="rounded-full bg-primary-600 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
