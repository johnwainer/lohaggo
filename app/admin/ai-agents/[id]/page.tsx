'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Save, Trash2 } from 'lucide-react'
import { ChannelIcon } from '@/components/admin/ChannelIcon'
import { AgentFace, CHANNEL_LABEL, usd, type Avatar } from '@/components/admin/ai/shared'
import KnowledgeTab from '@/components/admin/ai/KnowledgeTab'
import PlaygroundTab from '@/components/admin/ai/PlaygroundTab'

type Agent = Record<string, unknown> & {
  id: string
  workspaceId: string
  name: string
  avatar: string
  status: string
  channels: string[]
  autopilot: boolean
  autopilotChannels: string[]
  autopilotAccounts: string[]
  autopilotSkipTags: string[]
  handoffKeywords: string[]
  tools: string[]
  crmModules: string[]
  hoursDays: number[]
  conversations: number
  handoffs: number
  resolution: number | null
}
type Account = { key: string; channel: string; name: string; enabled: boolean }
type Catalog = {
  channels: string[]
  avatars: Avatar[]
  languages: string[]
  tools: Array<{ name: string; label: string; description: string; writes: boolean }>
  crmModules: Array<{ key: string; label: string }>
}

const TABS = [
  ['identity', 'Identidad'],
  ['model', 'Modelo'],
  ['channels', 'Canales y piloto automático'],
  ['handoff', 'Traspaso'],
  ['hours', 'Horario'],
  ['tools', 'Herramientas'],
  ['knowledge', 'Conocimiento'],
  ['test', 'Probar'],
] as const
type Tab = (typeof TABS)[number][0]

const LANG_LABEL: Record<string, string> = { auto: 'El del cliente', es: 'Español', en: 'Inglés', pt: 'Portugués', fr: 'Francés' }
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TIMEZONES = ['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Madrid']

const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm'
const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    {children}
    {hint && <span className="block text-xs text-gray-500">{hint}</span>}
  </label>
)
const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span><span className="text-sm text-gray-800">{label}</span>{hint && <span className="block text-xs text-gray-500">{hint}</span>}</span>
  </label>
)

export default function AiAgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('identity')
  const [agent, setAgent] = useState<Agent | null>(null)
  const [draft, setDraft] = useState<Partial<Agent>>({})
  const [perm, setPerm] = useState({ edit: false, knowledge: false, test: false })
  const [monthCost, setMonthCost] = useState<{ costUsd: number; calls: number } | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [platform, setPlatform] = useState<{ allowAgentModelOverride: boolean; defaultModel: string } | null>(null)
  const [wsTz, setWsTz] = useState('America/Bogota')
  const [models, setModels] = useState<Array<{ id: string; displayName: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [a, list] = await Promise.all([fetch(`/api/admin/ai/agents/${id}`), fetch('/api/admin/ai/agents')])
    const ad = await a.json().catch(() => ({}))
    if (!a.ok) { setError(ad.error || 'No encontrado'); return }
    const ld = await list.json().catch(() => ({}))
    setAgent(ad.agent)
    setPerm(ad.permissions)
    setMonthCost(ad.monthCost)
    setDraft({})
    setCatalog(ld.catalog)
    setPlatform(ld.platform)
    setAccounts((ld.accounts || []).find((x: { workspaceId: string }) => x.workspaceId === ad.agent.workspaceId)?.accounts || [])
    setWsTz((ld.workspaces || []).find((w: { id: string }) => w.id === ad.agent.workspaceId)?.timezone || 'America/Bogota')
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (tab === 'model' && !models.length) fetch('/api/admin/ai/models').then((r) => r.json()).then((d) => setModels(d.models || [])).catch(() => null)
  }, [tab, models.length])

  const v = useMemo(() => ({ ...(agent || {}), ...draft }) as Agent, [agent, draft])
  const set = (patch: Partial<Agent>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = Object.keys(draft).length > 0
  const ro = !perm.edit
  const toggleIn = (key: keyof Agent, value: string) => {
    const list = (v[key] as string[]) || []
    set({ [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] } as Partial<Agent>)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/ai/agents/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setAgent(data.agent)
      setDraft({})
      setNotice('Cambios guardados.')
      setTimeout(() => setNotice(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el agente "${v.name}"? Las conversaciones que lleva vuelven a la cola de personas.`)) return
    const res = await fetch(`/api/admin/ai/agents/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/ai-agents')
  }

  if (!agent || !catalog) {
    return <div className="p-6 flex items-center gap-2 text-gray-500">{error ? <><AlertCircle size={18} /> {error}</> : <><Loader2 className="animate-spin" size={18} /> Cargando…</>}</div>
  }

  const autopilotOnAll = v.autopilot && v.autopilotChannels.length === 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-28">
      <Link href="/admin/ai-agents" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft size={14} /> Agentes IA</Link>

      <div className="flex items-center gap-4 flex-wrap">
        <AgentFace avatar={v.avatar} avatars={catalog.avatars} size={56} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{v.name}</h1>
          <p className="text-sm text-gray-500">
            {v.conversations} conversaciones · {v.handoffs} traspasos · resolución {v.resolution == null ? '—' : `${v.resolution}%`}
            {monthCost ? ` · este mes ${usd(monthCost.costUsd)} (${monthCost.calls} llamadas)` : ''}
          </p>
        </div>
        <button disabled={ro} onClick={() => set({ status: v.status === 'active' ? 'paused' : 'active' })} className={`px-3 py-1.5 rounded-full text-sm font-medium ${v.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
          {v.status === 'active' ? '● Activo' : '○ Pausado'}
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}
      {ro && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Solo lectura: no tienes permiso para editar agentes en este workspace.</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === key ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
        ))}
      </div>

      <fieldset disabled={ro && tab !== 'knowledge' && tab !== 'test'} className="space-y-5">
        {tab === 'identity' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Cara</span>
              <div className="flex gap-2 flex-wrap">
                {catalog.avatars.map((a) => (
                  <button key={a.key} type="button" onClick={() => set({ avatar: a.key })} className={`rounded-2xl p-0.5 ${v.avatar === a.key ? 'ring-2 ring-primary-500' : ''}`}>
                    <AgentFace avatar={a.key} avatars={catalog.avatars} size={44} />
                  </button>
                ))}
              </div>
            </div>
            <Field label="Nombre" hint="Se guarda con cada mensaje: si lo cambias, el historial sigue diciendo quién contestó."><input className={input} value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Objetivo" hint="Qué debe conseguir con cada cliente. Cuando lo cumple, aplica la acción de la pestaña Traspaso."><textarea className={input} rows={2} value={String(v.goal ?? '')} onChange={(e) => set({ goal: e.target.value })} placeholder="Resolver dudas sobre servicios y ayudar a crear la solicitud" /></Field>
            <Field label="Instrucciones" hint="Cómo trabaja tu negocio. Di aquí si el cliente se trata de tú o de usted."><textarea className={input} rows={10} value={String(v.instructions ?? '')} onChange={(e) => set({ instructions: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tono"><input className={input} value={String(v.tone ?? '')} onChange={(e) => set({ tone: e.target.value })} /></Field>
              <Field label="Idioma">
                <select className={input} value={String(v.language)} onChange={(e) => set({ language: e.target.value })}>
                  {catalog.languages.map((l) => <option key={l} value={l}>{LANG_LABEL[l] || l}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}

        {tab === 'model' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            {platform?.allowAgentModelOverride ? (
              <Field label="Modelo" hint={`Vacío = el de la plataforma (${platform.defaultModel}).`}>
                <select className={input} value={String(v.model ?? '')} onChange={(e) => set({ model: e.target.value || null })}>
                  <option value="">El de la plataforma ({platform.defaultModel})</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.displayName} · {m.id}</option>)}
                </select>
              </Field>
            ) : (
              <p className="text-sm text-gray-600">Modelo: <strong>{platform?.defaultModel}</strong>, lo decide la plataforma.</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Longitud máxima de respuesta (tokens)" hint="512 ≈ un mensaje de chat largo."><input type="number" min={128} max={4096} className={input} value={Number(v.maxTokens)} onChange={(e) => set({ maxTokens: Number(e.target.value) })} /></Field>
              <Field label="Memoria (últimos mensajes)" hint="Mínimo 4. Lo anterior se resume automáticamente."><input type="number" min={4} max={100} className={input} value={Number(v.memoryWindow)} onChange={(e) => set({ memoryWindow: Number(e.target.value) })} /></Field>
            </div>
          </div>
        )}

        {tab === 'channels' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Canales que atiende</h3>
              <p className="text-xs text-gray-500">Ninguno marcado = todos. Si varios agentes atienden el mismo canal, contesta el que lo declara explícitamente; si no, el agente por defecto.</p>
              <div className="flex gap-2 flex-wrap">
                {catalog.channels.map((c) => (
                  <button key={c} type="button" onClick={() => toggleIn('channels', c)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${v.channels.includes(c) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-600'}`}>
                    <ChannelIcon channel={c} size={16} /> {CHANNEL_LABEL[c]}
                  </button>
                ))}
              </div>
              <Toggle checked={Boolean(v.isDefault)} onChange={(x) => set({ isDefault: x })} label="Agente por defecto del workspace" hint="Atiende los canales que ningún otro agente declara." />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Piloto automático</h3>
              <Toggle checked={Boolean(v.autopilot)} onChange={(x) => set({ autopilot: x })} label="Responder solo a los clientes" hint="Nunca contesta si una persona lleva la conversación, si alguien del equipo escribió en los últimos 30 minutos o si las automatizaciones están pausadas." />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Canales con piloto automático</p>
                <p className="text-xs text-gray-500">Hay que marcarlos uno a uno: «todos» no existe aquí, para que un número o una página real no quede en manos de la IA por accidente.</p>
                <div className="flex gap-2 flex-wrap">
                  {catalog.channels.map((c) => {
                    const disabled = v.channels.length > 0 && !v.channels.includes(c)
                    return (
                      <button key={c} type="button" disabled={disabled} onClick={() => toggleIn('autopilotChannels', c)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm disabled:opacity-40 ${v.autopilotChannels.includes(c) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-600'}`}>
                        <ChannelIcon channel={c} size={16} /> {CHANNEL_LABEL[c]}
                      </button>
                    )
                  })}
                </div>
                {autopilotOnAll && <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> Piloto encendido sin canales: no contestará a nadie.</p>}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Cuentas de canal</p>
                <p className="text-xs text-gray-500">Ninguna marcada = todas las de los canales elegidos.</p>
                {accounts.length === 0 ? <p className="text-xs text-gray-400">Este workspace no tiene cuentas conectadas.</p> : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {accounts.filter((a) => v.autopilotChannels.includes(a.channel)).map((a) => (
                      <label key={a.key} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <input type="checkbox" checked={v.autopilotAccounts.includes(a.key)} onChange={() => toggleIn('autopilotAccounts', a.key)} />
                        <ChannelIcon channel={a.channel} size={14} /> <span className="truncate">{a.name}</span>
                        {!a.enabled && <span className="text-[10px] text-gray-400">(pausada)</span>}
                      </label>
                    ))}
                    {v.autopilotChannels.length === 0 && <p className="text-xs text-gray-400">Elige primero los canales.</p>}
                  </div>
                )}
              </div>
              <Field label="No tomar conversaciones con estas etiquetas" hint="Separadas por comas, p. ej. vip, legal">
                <input className={input} value={v.autopilotSkipTags.join(', ')} onChange={(e) => set({ autopilotSkipTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Reenganche (horas sin respuesta del cliente)" hint="0 = apagado. Un único mensaje de seguimiento, una sola vez, dentro de la ventana de 24 h y del horario.">
                <input type="number" min={0} max={23} className={input} value={Number(v.reengageAfterHours)} onChange={(e) => set({ reengageAfterHours: Number(e.target.value) })} />
              </Field>
            </div>
          </div>
        )}

        {tab === 'handoff' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <Field label="Palabras que fuerzan el traspaso" hint="Separadas por comas. Se comprueban antes de llamar al modelo (sin coste).">
              <input className={input} value={v.handoffKeywords.join(', ')} onChange={(e) => set({ handoffKeywords: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="asesor, humano, persona, queja" />
            </Field>
            <Field label="Traspasar tras N respuestas" hint="0 = sin límite."><input type="number" min={0} className={input} value={Number(v.handoffAfterTurns)} onChange={(e) => set({ handoffAfterTurns: Number(e.target.value) })} /></Field>
            <Toggle checked={Boolean(v.handoffOnUnknown)} onChange={(x) => set({ handoffOnUnknown: x })} label="Traspasar cuando no sepa la respuesta" hint="Recomendado: sin esto el modelo tiende a inventar antes que reconocer que no sabe." />
            <Field label="Mensaje al traspasar"><textarea className={input} rows={2} value={String(v.handoffMessage ?? '')} onChange={(e) => set({ handoffMessage: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Al cumplir el objetivo">
                <select className={input} value={String(v.goalDoneAction)} onChange={(e) => set({ goalDoneAction: e.target.value })}>
                  <option value="none">No hacer nada</option>
                  <option value="close">Marcar como resuelta</option>
                  <option value="tag">Etiquetar</option>
                  <option value="handoff">Pasar a una persona</option>
                </select>
              </Field>
              {v.goalDoneAction === 'tag' && <Field label="Etiqueta"><input className={input} value={String(v.goalDoneTag ?? '')} onChange={(e) => set({ goalDoneTag: e.target.value })} /></Field>}
            </div>
            <Toggle checked={Boolean(v.ignoreSpam)} onChange={(x) => set({ ignoreSpam: x })} label="No responder a publicidad" hint="Marca la conversación (no el contacto) y no contesta. Ante la duda, contesta." />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Firma">
                <select className={input} value={String(v.signatureMode)} onChange={(e) => set({ signatureMode: e.target.value })}>
                  <option value="off">Sin firma (se despide con su nombre)</option>
                  <option value="every">En cada mensaje</option>
                  <option value="final">Solo en el último (traspaso u objetivo)</option>
                </select>
              </Field>
              {v.signatureMode !== 'off' && <Field label="Texto de la firma"><input className={input} value={String(v.signatureText ?? '')} onChange={(e) => set({ signatureText: e.target.value })} placeholder="— Equipo LoHaggo" /></Field>}
            </div>
          </div>
        )}

        {tab === 'hours' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <Toggle checked={Boolean(v.hoursEnabled)} onChange={(x) => set({ hoursEnabled: x })} label="Atender solo en horario" />
            <Field label="Zona horaria" hint={`Vacío = la de la cuenta (${wsTz}).`}>
              <select className={input} value={String(v.hoursTimezone ?? '')} onChange={(e) => set({ hoursTimezone: e.target.value || null })}>
                <option value="">La de la cuenta ({wsTz})</option>
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Días</span>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" onClick={() => set({ hoursDays: v.hoursDays.includes(i) ? v.hoursDays.filter((x) => x !== i) : [...v.hoursDays, i].sort() })} className={`w-12 py-1.5 rounded-xl text-sm border ${v.hoursDays.includes(i) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-500'}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Desde"><input type="time" className={input} value={String(v.hoursStart)} onChange={(e) => set({ hoursStart: e.target.value })} /></Field>
              <Field label="Hasta"><input type="time" className={input} value={String(v.hoursEnd)} onChange={(e) => set({ hoursEnd: e.target.value })} /></Field>
            </div>
            <Field label="Fuera de horario">
              <select className={input} value={String(v.outsideHours)} onChange={(e) => set({ outsideHours: e.target.value })}>
                <option value="notice">Avisar que estamos fuera de horario</option>
                <option value="handoff">Pasar a una persona</option>
                <option value="silent">No responder</option>
              </select>
            </Field>
            {v.outsideHours === 'notice' && <Field label="Mensaje fuera de horario" hint="Se envía como mucho una vez cada 12 horas por conversación."><textarea className={input} rows={2} value={String(v.outsideHoursMessage ?? '')} onChange={(e) => set({ outsideHoursMessage: e.target.value })} /></Field>}
          </div>
        )}

        {tab === 'tools' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <p className="text-xs text-gray-500">El agente solo puede usar las que marques. En «Probar», las que escriben corren en seco.</p>
            <div className="space-y-3">
              {catalog.tools.map((t) => (
                <label key={t.name} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={v.tools.includes(t.name)} onChange={() => toggleIn('tools', t.name)} />
                  <span className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{t.label}</span> <span className="font-mono text-[11px] text-gray-400">{t.name}</span>
                    <span className="block text-xs text-gray-500">{t.description}{t.writes ? '' : ' (solo lectura)'}</span>
                    {t.name === 'consultar_crm' && v.tools.includes(t.name) && (
                      <span className="flex gap-3 flex-wrap mt-2">
                        {catalog.crmModules.map((m) => (
                          <span key={m.key} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                            <input type="checkbox" checked={v.crmModules.includes(m.key)} onChange={() => toggleIn('crmModules', m.key)} /> {m.label}
                          </span>
                        ))}
                      </span>
                    )}
                    {t.name === 'avisar_webhook' && v.tools.includes(t.name) && (
                      <input className={`${input} mt-2`} value={String(v.webhookUrl ?? '')} onChange={(e) => set({ webhookUrl: e.target.value })} placeholder="https://tu-sistema.com/webhook" />
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">Agenda y cobros no aparecen porque esta plataforma no tiene una agenda ni un cobro libre que el agente pueda usar sobre un contacto cualquiera.</p>
          </div>
        )}
      </fieldset>

      {tab === 'knowledge' && <KnowledgeTab workspaceId={agent.workspaceId} agentId={agent.id} agentName={agent.name} />}
      {tab === 'test' && <PlaygroundTab agentId={agent.id} canTest={perm.test} dirty={dirty} />}

      {perm.edit && tab !== 'knowledge' && tab !== 'test' && (
        <div className="fixed bottom-0 inset-x-0 lg:left-64 bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-3 flex items-center justify-between gap-3 z-30">
          <button onClick={remove} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"><Trash2 size={14} /> Eliminar agente</button>
          <div className="flex items-center gap-3">
            {notice && <span className="text-sm text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={14} /> {notice}</span>}
            {dirty && <button onClick={() => setDraft({})} className="text-sm text-gray-500 hover:underline">Descartar</button>}
            <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
