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
  copilotChannels: string[]
  commentChannels: string[]
  commentCopilotChannels: string[]
  commentAccounts: string[]
  commentReplyMode: Record<string, string> | null
  commentAlwaysKeywords: string[]
  commentNeverKeywords: string[]
  handoffKeywords: string[]
  tools: string[]
  crmModules: string[]
  hoursDays: number[]
  conversations: number
  handoffs: number
  resolution: number | null
}
type Account = { key: string; legacyKey?: string; channel: string; name: string; enabled: boolean }
type Catalog = {
  channels: string[]
  commentChannels: string[]
  avatars: Avatar[]
  languages: string[]
  tools: Array<{ name: string; label: string; description: string; writes: boolean }>
  crmModules: Array<{ key: string; label: string }>
}

const TABS = [
  ['identity', 'Identidad'],
  ['model', 'Modelo'],
  ['channels', 'Canales y piloto'],
  ['comments', 'Comentarios'],
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
/** Free typing (commas, spaces) for a list field; the list is parsed when the field loses focus. */
function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join(', '))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(value.join(', ')) }, [value, focused])
  const commit = () => onChange(Array.from(new Set(text.split(',').map((t) => t.trim()).filter(Boolean))))
  return (
    <input
      className={input}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit() }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
    />
  )
}

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
  const [monthCost, setMonthCost] = useState<{ costUsd: number; calls: number; byProvider?: Array<{ provider: string; calls: number }>; last?: { provider: string; model: string; createdAt: string } | null } | null>(null)
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
          {monthCost?.last && (
            <p className="text-xs text-gray-500 mt-0.5">
              Última respuesta con {monthCost.last.provider === 'openai' ? 'OpenAI' : 'Claude'} ({monthCost.last.model}, {new Date(monthCost.last.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })})
              {(monthCost.byProvider?.length ?? 0) > 1 ? ` · este mes: ${monthCost.byProvider!.map((p) => `${p.provider === 'openai' ? 'OpenAI' : 'Claude'} ${p.calls}`).join(', ')} llamadas` : ''}
            </p>
          )}
        </div>
        <button disabled={ro} onClick={() => set({ status: v.status === 'active' ? 'paused' : 'active' })} className={`px-3 py-1.5 rounded-full text-sm font-medium ${v.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
          {v.status === 'active' ? '● Activo' : '○ Pausado'}
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}
      {ro && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Solo lectura: no tienes permiso para editar agentes en este workspace.</div>}

      {/* Wraps to a second line on narrow screens instead of scrolling sideways */}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-gray-100 p-1">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>
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
                        <input
                          type="checkbox"
                          checked={v.autopilotAccounts.includes(a.key) || (!!a.legacyKey && v.autopilotAccounts.includes(a.legacyKey))}
                          onChange={() => {
                            // Saved with the stable key; an old connection-id entry is replaced
                            const on = v.autopilotAccounts.includes(a.key) || (!!a.legacyKey && v.autopilotAccounts.includes(a.legacyKey))
                            const rest = v.autopilotAccounts.filter((k) => k !== a.key && k !== a.legacyKey)
                            set({ autopilotAccounts: on ? rest : [...rest, a.key] })
                          }}
                        />
                        <ChannelIcon channel={a.channel} size={14} /> <span className="truncate">{a.name}</span>
                        {!a.enabled && <span className="text-[10px] text-gray-400">(pausada)</span>}
                      </label>
                    ))}
                    {v.autopilotChannels.length === 0 && <p className="text-xs text-gray-400">Elige primero los canales.</p>}
                  </div>
                )}
              </div>
              <Field label="No tomar conversaciones con estas etiquetas" hint="Separadas por comas, p. ej. vip, legal">
                <ListInput value={v.autopilotSkipTags} onChange={(list) => set({ autopilotSkipTags: list.map((t) => t.toLowerCase()) })} placeholder="vip, legal" />
              </Field>
              <Field label="Reenganche (horas sin respuesta del cliente)" hint="0 = apagado. Un único mensaje de seguimiento, una sola vez, dentro de la ventana de 24 h y del horario.">
                <input type="number" min={0} max={23} className={input} value={Number(v.reengageAfterHours)} onChange={(e) => set({ reengageAfterHours: Number(e.target.value) })} />
              </Field>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Copiloto</h3>
              <p className="text-xs text-gray-500">
                En estos canales la conversación la lleva una persona y el agente la ayuda: le sugiere respuestas en una tarjeta sobre el cuadro de escritura y,
                si el cliente se queda sin respuesta, la retoma. Si un canal también tiene piloto automático, manda el piloto automático.
              </p>
              <div className="flex gap-2 flex-wrap">
                {catalog.channels.map((c) => {
                  const disabled = v.channels.length > 0 && !v.channels.includes(c)
                  return (
                    <button key={c} type="button" disabled={disabled} onClick={() => toggleIn('copilotChannels', c)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm disabled:opacity-40 ${v.copilotChannels.includes(c) ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-600'}`}>
                      <ChannelIcon channel={c} size={16} /> {CHANNEL_LABEL[c]}
                      {v.autopilot && v.autopilotChannels.includes(c) && v.copilotChannels.includes(c) && <span className="text-[10px] text-amber-700">(piloto manda)</span>}
                    </button>
                  )
                })}
              </div>
              {v.copilotChannels.length > 0 && (
                <>
                  <Field label="Sugerencias de respuesta" hint="Cada sugerencia automática cuesta como una respuesta de la IA.">
                    <select className={input} value={String(v.copilotSuggest)} onChange={(e) => set({ copilotSuggest: e.target.value })}>
                      <option value="auto">Automáticas cuando escribe el cliente, y también bajo demanda</option>
                      <option value="manual">Solo bajo demanda (botón «Sugerir respuesta»)</option>
                    </select>
                  </Field>
                  <Toggle checked={Boolean(v.copilotTakeover)} onChange={(x) => set({ copilotTakeover: x })} label="Retomar la conversación si nadie responde" hint="Solo dentro del horario del agente y de la ventana de 24 h. Nunca retoma casos que la IA traspasó ni con etiquetas excluidas: en esos avisa al equipo." />
                  {Boolean(v.copilotTakeover) && (
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Minutos sin respuesta para retomar">
                        <input type="number" min={1} max={720} className={input} value={Number(v.copilotTakeoverMinutes)} onChange={(e) => set({ copilotTakeoverMinutes: Number(e.target.value) })} />
                      </Field>
                      <Field label="Aviso previo (minutos)" hint="0 = sin aviso">
                        <input type="number" min={0} max={60} className={input} value={Number(v.copilotWarnMinutes)} onChange={(e) => set({ copilotWarnMinutes: Number(e.target.value) })} />
                      </Field>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'comments' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Comentarios en publicaciones y anuncios</h3>
              <p className="text-xs text-gray-500">
                Cuando alguien comenta una publicación o un anuncio de una página de Facebook o de la cuenta de Instagram, el agente puede contestar en público
                y/o por mensaje privado. Primero hay que activar «Recibir comentarios» en esa cuenta, en Admin → Canales.
              </p>
              {catalog.commentChannels.map((c) => {
                const mode = v.commentChannels.includes(c) ? 'autopilot' : v.commentCopilotChannels.includes(c) ? 'copilot' : 'off'
                const setMode = (m: string) => set({
                  commentChannels: m === 'autopilot' ? Array.from(new Set([...v.commentChannels, c])) : v.commentChannels.filter((x) => x !== c),
                  commentCopilotChannels: m === 'copilot' ? Array.from(new Set([...v.commentCopilotChannels, c])) : v.commentCopilotChannels.filter((x) => x !== c),
                })
                const replyMode = v.commentReplyMode?.[c] || 'public_and_private'
                return (
                  <div key={c} className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ChannelIcon channel={c} size={18} /> <span className="text-sm font-medium text-gray-900">{CHANNEL_LABEL[c]}</span>
                      <select className="ml-auto border border-gray-200 rounded-xl px-3 py-1.5 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
                        <option value="off">Apagado</option>
                        <option value="autopilot">Piloto automático (responde solo)</option>
                        <option value="copilot">Copiloto (sugiere a una persona)</option>
                      </select>
                    </div>
                    {mode !== 'off' && (
                      <Field label="Cómo responde" hint="La respuesta privada es un mensaje directo ligado al comentario: Meta permite una sola por comentario y dentro de 7 días. Si la persona contesta, sigue en su chat de Messenger / Instagram.">
                        <select className={input} value={replyMode} onChange={(e) => set({ commentReplyMode: { ...(v.commentReplyMode || {}), [c]: e.target.value } })}>
                          <option value="public_and_private">Respuesta pública breve y el detalle por privado</option>
                          <option value="public_only">Solo respuesta pública</option>
                          <option value="private_only">Solo por privado</option>
                        </select>
                      </Field>
                    )}
                  </div>
                )
              })}
              {(v.commentChannels.length > 0 || v.commentCopilotChannels.length > 0) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Cuentas</p>
                  <p className="text-xs text-gray-500">Ninguna marcada = todas las cuentas de los canales elegidos.</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {accounts.filter((a) => v.commentChannels.includes(a.channel) || v.commentCopilotChannels.includes(a.channel)).map((a) => (
                      <label key={a.key} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <input type="checkbox" checked={v.commentAccounts.includes(a.key)} onChange={() => toggleIn('commentAccounts', a.key)} />
                        <ChannelIcon channel={a.channel} size={14} /> <span className="truncate">{a.name}</span>
                        {!a.enabled && <span className="text-[10px] text-amber-700">(comentarios apagados en Canales)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Qué responde</h3>
              <Field label="Comentarios a los que responde" hint="Con «solo los que lo piden» el agente decide: no contesta emojis sueltos, etiquetas a amigos, trolls ni conversaciones entre otras personas. Ante una pregunta o una queja real, responde.">
                <select className={input} value={String(v.commentScope)} onChange={(e) => set({ commentScope: e.target.value })}>
                  <option value="intent">Solo los que piden respuesta (lo decide el agente)</option>
                  <option value="all">Todos los comentarios</option>
                </select>
              </Field>
              <Field label="Responder siempre si contiene" hint="Separadas por comas. Se comprueban antes de llamar al modelo (sin costo), p. ej. precio, info, cotización.">
                <ListInput value={v.commentAlwaysKeywords} onChange={(list) => set({ commentAlwaysKeywords: list })} placeholder="precio, info, cotización" />
              </Field>
              <Field label="No responder nunca si contiene" hint="Separadas por comas. Tienen prioridad sobre la lista anterior.">
                <ListInput value={v.commentNeverKeywords} onChange={(list) => set({ commentNeverKeywords: list })} placeholder="sorteo, concurso" />
              </Field>
              <Toggle checked={Boolean(v.commentIgnoreTagOnly)} onChange={(x) => set({ commentIgnoreTagOnly: x })} label="Ignorar comentarios que solo etiquetan a otras personas" hint="«@ana @luis mira esto» no se responde y no gasta una llamada." />
              <Field label="Texto público fijo (opcional)" hint="Si lo escribes, la respuesta pública es siempre este texto y el agente solo redacta el mensaje privado. {nombre} se reemplaza por el nombre de la persona.">
                <input className={input} value={String(v.commentPublicTemplate ?? '')} onChange={(e) => set({ commentPublicTemplate: e.target.value })} placeholder="¡Hola {nombre}! Te escribimos por privado 🙌" />
              </Field>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Temas sensibles y moderación</h3>
              <Field label="Ante reembolsos, quejas, seguridad o datos personales" hint="Nunca se contesta el fondo del tema en público. Las palabras de traspaso (pestaña Traspaso) siempre pasan el caso a una persona.">
                <select className={input} value={String(v.commentSensitiveAction)} onChange={(e) => set({ commentSensitiveAction: e.target.value })}>
                  <option value="private_and_handoff">Mensaje privado breve y pasar a una persona</option>
                  <option value="private_only">Solo mensaje privado</option>
                  <option value="handoff_only">Pasar a una persona sin responder</option>
                </select>
              </Field>
              <Toggle checked={Boolean(v.commentHideOffensive)} onChange={(x) => set({ commentHideOffensive: x })} label="Ocultar comentarios ofensivos" hint="Ocultar no borra: la persona y sus amigos lo siguen viendo, el resto no. Queda registrado en la conversación y se puede mostrar de nuevo." />
              <Toggle checked={Boolean(v.commentHideSpam)} onChange={(x) => set({ commentHideSpam: x })} label="Ocultar spam" hint="Publicidad y enlaces sin relación con el negocio. Si está apagado, solo se registra y no se responde." />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Límites</h3>
              <p className="text-xs text-gray-500">Frenan una avalancha (un anuncio viral, un ataque de spam). Al llegar al límite la IA deja de responder y avisa con una nota interna.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Respuestas por publicación y hora"><input type="number" min={1} max={1000} className={input} value={Number(v.commentMaxPerPostPerHour)} onChange={(e) => set({ commentMaxPerPostPerHour: Number(e.target.value) })} /></Field>
                <Field label="Respuestas por cuenta y día"><input type="number" min={1} max={1000} className={input} value={Number(v.commentMaxPerAccountPerDay)} onChange={(e) => set({ commentMaxPerAccountPerDay: Number(e.target.value) })} /></Field>
              </div>
            </div>
          </div>
        )}

        {tab === 'handoff' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <Field label="Palabras que fuerzan el traspaso" hint="Separadas por comas. Se comprueban antes de llamar al modelo (sin coste).">
              <ListInput value={v.handoffKeywords} onChange={(list) => set({ handoffKeywords: list })} placeholder="asesor, humano, persona, queja" />
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
