'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { DOMAINS, DOMAIN_LABEL } from '@/lib/haggo/config'
import { EFFECTS, EFFECT_LABEL, type DirectiveRule } from '@/lib/haggo/directives'
import { api, btn, btnPrimary, card, when } from '@/components/admin/haggo/shared'

type Directive = { id: string; text: string; rule: DirectiveRule | null; ruleText: string | null; active: boolean; createdByEmail: string | null; createdAt: string }
type Draft = { id: string | null; text: string; withRule: boolean; rule: { effect: string; domain: string; tools: string; days: number[]; from: string; to: string } }

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const input = 'rounded-xl border border-gray-200 px-3 py-2 text-sm'
const empty: Draft = { id: null, text: '', withRule: false, rule: { effect: 'forbid', domain: '', tools: '', days: [], from: '', to: '' } }

function toDraft(d: Directive): Draft {
  const r = d.rule
  return { id: d.id, text: d.text, withRule: Boolean(r), rule: { effect: r?.effect ?? 'forbid', domain: r?.domain ?? '', tools: r?.tools?.join(', ') ?? '', days: r?.days ?? [], from: r?.from ?? '', to: r?.to ?? '' } }
}

function ruleBody(d: Draft) {
  if (!d.withRule) return null
  const r = d.rule
  return { effect: r.effect, domain: r.domain || undefined, tools: r.tools.trim() ? r.tools.split(',').map((t) => t.trim()).filter(Boolean) : undefined, days: r.days.length ? r.days : undefined, from: r.from || undefined, to: r.to || undefined }
}

/** Rules Haggo always follows. Written here or confirmed from the conversation; Haggo can never change them. */
export function DirectivesSection() {
  const [list, setList] = useState<Directive[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => setList((await api<{ directives: Directive[] }>('/api/admin/haggo/directives')).directives), [])
  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  async function call(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await load()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft) return
    const body = JSON.stringify({ text: draft.text, rule: ruleBody(draft) })
    const ok = await call(() => (draft.id ? api(`/api/admin/haggo/directives/${draft.id}`, { method: 'PATCH', body }) : api('/api/admin/haggo/directives', { method: 'POST', body })))
    if (ok) setDraft(null)
  }

  const setRule = (patch: Partial<Draft['rule']>) => setDraft((d) => (d ? { ...d, rule: { ...d.rule, ...patch } } : d))

  return (
    <section className={`${card} space-y-4 p-5`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">Directivas</h2>
          <p className="mt-0.5 text-xs text-gray-500">Reglas que Haggo respeta siempre, en cada revisión, informe y conversación. También puedes dictárselas en la conversación y confirmarlas allí. Haggo nunca puede crearlas, cambiarlas ni apagarlas por su cuenta.</p>
        </div>
        {!draft && <button onClick={() => setDraft({ ...empty })} className={btn}><Plus size={14} /> Nueva directiva</button>}
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-4">
          <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={2} maxLength={500} placeholder="Ej.: No publiques en redes los domingos" className={`${input} w-full`} />
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draft.withRule} onChange={(e) => setDraft({ ...draft, withRule: e.target.checked })} /> Hacerla cumplir automáticamente cuando Haggo pueda actuar</label>
          {draft.withRule && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm"><span className="text-gray-700">Efecto</span>
                <select value={draft.rule.effect} onChange={(e) => setRule({ effect: e.target.value })} className={`${input} mt-1 w-full`}>{EFFECTS.map((e) => <option key={e} value={e}>{EFFECT_LABEL[e]}</option>)}</select>
              </label>
              <label className="text-sm"><span className="text-gray-700">Área</span>
                <select value={draft.rule.domain} onChange={(e) => setRule({ domain: e.target.value })} className={`${input} mt-1 w-full`}><option value="">Cualquiera</option>{DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}</select>
              </label>
              <label className="text-sm sm:col-span-2"><span className="text-gray-700">Acciones (opcional, separadas por coma; «marketing.*» = todas las de marketing)</span>
                <input value={draft.rule.tools} onChange={(e) => setRule({ tools: e.target.value })} className={`${input} mt-1 w-full`} />
              </label>
              <div className="text-sm sm:col-span-2"><span className="text-gray-700">Días (opcional)</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {DAYS.map((d, i) => <button key={d} type="button" onClick={() => setRule({ days: draft.rule.days.includes(i) ? draft.rule.days.filter((x) => x !== i) : [...draft.rule.days, i].sort() })} className={`h-8 w-11 rounded-lg text-xs font-medium ${draft.rule.days.includes(i) ? 'bg-primary-600 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>{d}</button>)}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm sm:col-span-2"><span className="text-gray-700">Horario (opcional): de</span><input type="time" value={draft.rule.from} onChange={(e) => setRule({ from: e.target.value })} className={`${input} py-1`} /><span className="text-gray-700">a</span><input type="time" value={draft.rule.to} onChange={(e) => setRule({ to: e.target.value })} className={`${input} py-1`} /></div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !draft.text.trim()} className={btnPrimary}>{busy && <Loader2 size={14} className="animate-spin" />} Guardar</button>
            <button onClick={() => { setDraft(null); setError(null) }} className={btn}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!list ? <p className="text-sm text-gray-500">Cargando…</p> : list.length === 0 ? <p className="text-sm text-gray-500">Sin directivas todavía.</p> : (
        <ul className="divide-y divide-gray-100">
          {list.map((d) => (
            <li key={d.id} className="flex items-start gap-3 py-3">
              <input type="checkbox" checked={d.active} disabled={busy} title={d.active ? 'Activa' : 'Inactiva'} onChange={(e) => call(() => api(`/api/admin/haggo/directives/${d.id}`, { method: 'PATCH', body: JSON.stringify({ active: e.target.checked }) }))} className="mt-1" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${d.active ? 'text-gray-900' : 'text-gray-400'}`}>{d.text}</p>
                <p className="text-xs text-gray-500">{d.ruleText ? `${d.ruleText} · ` : 'Solo texto · '}{d.createdByEmail ?? '—'} · {when(d.createdAt)}</p>
              </div>
              <button onClick={() => setDraft(toDraft(d))} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Editar"><Pencil size={14} /></button>
              <button onClick={() => { if (window.confirm('¿Borrar esta directiva?')) call(() => api(`/api/admin/haggo/directives/${d.id}`, { method: 'DELETE' })) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="Borrar"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
