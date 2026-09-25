'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { CHANNEL_NAME, MkChannelIcon, OBJECTIVES, api, input, type MkChannel } from '@/components/admin/marketing/shared'
import { AGENT_FORMATS, AWARENESS, AWARENESS_LABEL, DEFAULT_SETTINGS, KPIS, KPI_BY_OBJECTIVE, KPI_LABEL, defaultAgentConfig } from '@/lib/marketing/agent-input'
import { MODE_INFO, type AgentConfig, type AgentDetailData, type AgentSettings, type WizardOptions } from '@/components/admin/marketing/agent/types'

type Ws = { id: string; name: string; permissions: string[] }
type CampaignForm = { name: string; objective: string; description: string; startsAt: string; endsAt: string }

const STEPS = ['Objetivo y medición', 'Negocio y oferta', 'Audiencia', 'Voz y límites', 'Canales y horarios', 'Autonomía'] as const
const CHANNELS: MkChannel[] = ['INSTAGRAM', 'FACEBOOK', 'WEB']
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const FORMAT_LABEL: Record<string, string> = { feed: 'Imagen', carousel: 'Carrusel', foto: 'Foto', texto: 'Solo texto', enlace: 'Enlace', guía: 'Guía', lista: 'Lista', comparativa: 'Comparativa', preguntas: 'Preguntas frecuentes', caso: 'Caso real' }
const SEGMENT_PRESETS = ['Cliente final (hogares)', 'Empresas y conjuntos', 'Socios a reclutar (profesionales)']

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

/** One item per line ↔ string[] */
function Lines({ value, onChange, placeholder, rows = 3 }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number }) {
  const [text, setText] = useState(value.join('\n'))
  useEffect(() => { setText(value.join('\n')) }, [value.join('\n')]) // eslint-disable-line react-hooks/exhaustive-deps
  return <textarea className={input} rows={rows} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split('\n').map((l) => l.trim()).filter(Boolean))} />
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{on && <Check size={13} />}{children}</button>
}

const dateOnly = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '')

/**
 * The agent's onboarding in 6 steps. Each "Siguiente" saves (the first one creates the campaign and
 * the agent as a draft), so the person can leave and come back. Also used to edit a working agent.
 */
export default function AgentWizard({ workspace, existing, onClose, onSaved }: {
  workspace: Ws
  existing?: AgentDetailData | null
  onClose: () => void
  onSaved: (agentId: string, generate: boolean) => void
}) {
  const canPublish = workspace.permissions.includes('marketing.publish')
  const [step, setStep] = useState(0)
  const [options, setOptions] = useState<WizardOptions | null>(null)
  const [agentId, setAgentId] = useState<string | null>(existing?.agent.id ?? null)
  const [campaignId, setCampaignId] = useState<string>(existing?.agent.campaign.id ?? '')
  const [campaign, setCampaign] = useState<CampaignForm>({
    name: existing?.agent.campaign.name ?? '', objective: existing?.agent.campaign.objective ?? 'reach', description: existing?.agent.campaign.description ?? '',
    startsAt: dateOnly(existing?.agent.campaign.startsAt), endsAt: dateOnly(existing?.agent.campaign.endsAt),
  })
  const [config, setConfig] = useState<AgentConfig>(existing?.agent.config ?? defaultAgentConfig('reach'))
  const [settings, setSettings] = useState<AgentSettings>(existing?.agent.settings ?? DEFAULT_SETTINGS)
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceQ, setServiceQ] = useState('')

  useEffect(() => {
    api<WizardOptions>(`/api/admin/marketing/agents/options?workspaceId=${workspace.id}`).then(setOptions).catch((e) => setError(e.message))
  }, [workspace.id])

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => setConfig((c) => ({ ...c, [k]: v }))
  const setOffer = (p: Partial<AgentConfig['offer']>) => setConfig((c) => ({ ...c, offer: { ...c.offer, ...p } }))
  const setAudience = (p: Partial<AgentConfig['audience']>) => setConfig((c) => ({ ...c, audience: { ...c.audience, ...p } }))
  const setVoice = (p: Partial<AgentConfig['voice']>) => setConfig((c) => ({ ...c, voice: { ...c.voice, ...p } }))
  const setSchedule = (p: Partial<AgentConfig['schedule']>) => setConfig((c) => ({ ...c, schedule: { ...c.schedule, ...p } }))
  const setChannel = (ch: MkChannel, p: Partial<AgentConfig['channels'][MkChannel]>) => setConfig((c) => ({ ...c, channels: { ...c.channels, [ch]: { ...c.channels[ch], ...p } } }))

  const autonomyUp = settings.mode !== 'copilot' || Object.values(settings.modeByChannel ?? {}).some((m) => m !== 'copilot')
  const needsConfirm = autonomyUp && (!existing || existing.agent.mode === 'copilot' || settings.mode !== existing.agent.mode)
  const filteredServices = useMemo(() => (options?.services ?? []).filter((s) => !serviceQ || `${s.name} ${s.category ?? ''}`.toLowerCase().includes(serviceQ.toLowerCase())), [options, serviceQ])

  async function save(next: number | 'finish') {
    setSaving(true)
    setError(null)
    try {
      const campaignBody = { ...campaign, startsAt: campaign.startsAt ? `${campaign.startsAt}T00:00:00-05:00` : null, endsAt: config.alwaysOn || !campaign.endsAt ? null : `${campaign.endsAt}T23:59:59-05:00` }
      let id = agentId
      if (!id) {
        if (!campaignId && !campaign.name.trim()) throw new Error('Ponle un nombre a la campaña')
        const d = await api<{ agent: { id: string; campaignId: string } }>('/api/admin/marketing/agents', {
          method: 'POST', json: { workspaceId: workspace.id, campaignId: campaignId || undefined, campaign: campaignId ? undefined : campaignBody, config, settings: { ...settings, mode: 'copilot', modeByChannel: null } },
        })
        id = d.agent.id
        setAgentId(id)
        setCampaignId(d.agent.campaignId)
      } else {
        await api(`/api/admin/marketing/agents/${id}`, { method: 'PATCH', json: { config, campaign: campaignBody, settings, confirmAutonomy: confirm } })
      }
      if (next === 'finish') onSaved(id!, !existing?.agent.strategy)
      else setStep(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const accounts = options?.accounts ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <div className="flex w-full max-h-[94vh] flex-col rounded-t-3xl sm:max-w-3xl sm:rounded-3xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <p className="text-xs font-medium text-primary-700">{existing ? 'Configuración del agente' : 'Nuevo agente de marketing'} · Paso {step + 1} de {STEPS.length}</p>
            <h2 className="text-lg font-semibold text-gray-900">{STEPS[step]}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => agentId && setStep(i)} disabled={!agentId} title={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary-500' : 'bg-gray-200'} ${agentId ? 'cursor-pointer' : ''}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!options && !error && <Loader2 className="animate-spin text-gray-400" />}

          {options && step === 0 && (
            <>
              {!existing && !agentId && options.campaigns.length > 0 && (
                <Field label="Campaña" hint="Usa una campaña existente o crea una nueva para el agente.">
                  <select className={input} value={campaignId} onChange={(e) => {
                    const c = options.campaigns.find((x) => x.id === e.target.value)
                    setCampaignId(e.target.value)
                    if (c) { setCampaign({ name: c.name, objective: c.objective, description: c.description ?? '', startsAt: dateOnly(c.startsAt), endsAt: dateOnly(c.endsAt) }); set('kpi', KPI_BY_OBJECTIVE[c.objective] ?? 'reach') }
                  }}>
                    <option value="">Crear una campaña nueva</option>
                    {options.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre de la campaña"><input className={input} value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} placeholder="Ej. Temporada de lluvias" /></Field>
                <Field label="Objetivo" hint="Lo que la campaña quiere lograr. El agente decide todo contra esto.">
                  <select className={input} value={campaign.objective} onChange={(e) => { setCampaign({ ...campaign, objective: e.target.value }); set('kpi', KPI_BY_OBJECTIVE[e.target.value] ?? 'reach') }}>
                    {Object.entries(OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="De qué trata" hint="Mensaje, público, contexto. El agente lo lee como punto de partida."><textarea className={input} rows={3} value={campaign.description} onChange={(e) => setCampaign({ ...campaign, description: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="KPI principal" hint="Cómo sabremos si funciona. Sale del objetivo; puedes cambiarlo.">
                  <select className={input} value={config.kpi} onChange={(e) => set('kpi', e.target.value as AgentConfig['kpi'])}>{KPIS.map((k) => <option key={k} value={k}>{KPI_LABEL[k]}</option>)}</select>
                </Field>
                <Field label="Meta (opcional)" hint={config.kpi === 'engagement' ? 'En %: p. ej. 4' : 'Un número para toda la campaña'}>
                  <input type="number" min={0} className={input} value={config.goal ?? ''} onChange={(e) => set('goal', e.target.value === '' ? null : Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Inicio"><input type="date" className={input} value={campaign.startsAt} onChange={(e) => setCampaign({ ...campaign, startsAt: e.target.value })} /></Field>
                <Field label="Fin"><input type="date" className={input} disabled={config.alwaysOn} value={config.alwaysOn ? '' : campaign.endsAt} onChange={(e) => setCampaign({ ...campaign, endsAt: e.target.value })} /></Field>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-700"><input type="checkbox" checked={config.alwaysOn} onChange={(e) => set('alwaysOn', e.target.checked)} /> Siempre activa</label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Presupuesto de IA del agente (US$ al mes)" hint={`Redacción, planificación e imágenes. Al 80 % te avisa; al 100 % deja de redactar.${canPublish ? '' : ' Subirlo requiere permiso de publicar.'}`}>
                  <input type="number" min={0} step={1} className={input} value={settings.monthlyBudgetUsd} onChange={(e) => setSettings({ ...settings, monthlyBudgetUsd: Number(e.target.value) })} />
                </Field>
                <Field label="Tope por publicación para imágenes con IA (US$)" hint="Si una imagen generada costaría más, usa fotos de Pexels.">
                  <input type="number" min={0} step={0.01} className={input} value={config.budget.maxImageUsdPerPost} onChange={(e) => set('budget', { maxImageUsdPerPost: Number(e.target.value) })} />
                </Field>
              </div>
            </>
          )}

          {options && step === 1 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">Servicios a promocionar</span>
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={config.offer.allServices} onChange={(e) => setOffer({ allServices: e.target.checked })} /> Todo el catálogo</label>
                </div>
                {!config.offer.allServices && (
                  <>
                    <input className={input} placeholder="Buscar servicio" value={serviceQ} onChange={(e) => setServiceQ(e.target.value)} />
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-2 grid gap-1 sm:grid-cols-2">
                      {filteredServices.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={config.offer.serviceIds.includes(s.id)} onChange={() => setOffer({ serviceIds: config.offer.serviceIds.includes(s.id) ? config.offer.serviceIds.filter((x) => x !== s.id) : [...config.offer.serviceIds, s.id] })} />
                          <span className="truncate">{s.name}</span><span className="ml-auto text-[11px] text-gray-400">{s.category}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">{config.offer.serviceIds.length} elegidos. El agente solo habla de estos servicios y usa su precio base del catálogo.</p>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-800">Ciudades</span>
                <div className="flex flex-wrap gap-2">{options.cities.map((c) => <Toggle key={c} on={config.offer.cities.includes(c)} onClick={() => setOffer({ cities: config.offer.cities.includes(c) ? config.offer.cities.filter((x) => x !== c) : [...config.offer.cities, c] })}>{c}</Toggle>)}</div>
                <p className="text-xs text-gray-500">Sin ninguna elegida, usa todas las activas.</p>
              </div>
              <Field label="Propuesta de valor" hint="Por qué elegir LoHaggo, en una o dos frases."><textarea className={input} rows={2} value={config.offer.valueProp} onChange={(e) => setOffer({ valueProp: e.target.value })} /></Field>
              <Field label="Diferenciales (uno por línea)"><Lines value={config.offer.differentiators} onChange={(v) => setOffer({ differentiators: v })} placeholder={'Profesionales verificados\nPago seguro en la app'} /></Field>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-800">Promociones vigentes</span>
                <p className="text-xs text-gray-500">Son las únicas que el agente puede mencionar. Al vencer, deja de mencionarlas y bloquea cualquier pieza que lo haga.</p>
                {config.offer.promos.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={input} value={p.text} placeholder="Ej. Código LLUVIA20: 20 % en plomería" onChange={(e) => setOffer({ promos: config.offer.promos.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                    <input type="date" className="rounded-xl border border-gray-200 px-2 text-sm" value={dateOnly(p.endsAt)} onChange={(e) => setOffer({ promos: config.offer.promos.map((x, j) => (j === i ? { ...x, endsAt: e.target.value || null } : x)) })} />
                    <button type="button" onClick={() => setOffer({ promos: config.offer.promos.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOffer({ promos: [...config.offer.promos, { text: '', endsAt: null }] })} className="inline-flex items-center gap-1 text-sm text-primary-700"><Plus size={14} /> Añadir promoción</button>
              </div>
              <Field label="Datos que puede citar (uno por línea)" hint="Cifras o hechos verificados. Cualquier otro precio o porcentaje manda la pieza a revisión."><Lines value={config.offer.facts} onChange={(v) => setOffer({ facts: v })} placeholder="Más de 500 socios verificados en Medellín" /></Field>
              <Field label="Sobre precios" hint="Vacío: solo el precio base del catálogo."><input className={input} value={config.offer.priceNotes} onChange={(e) => setOffer({ priceNotes: e.target.value })} placeholder="Ej. La visita de diagnóstico es gratis" /></Field>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-800">Enlaces que puede usar</span>
                {config.offer.links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="w-40 rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Nombre" value={l.label} onChange={(e) => setOffer({ links: config.offer.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <input className={input} placeholder="https://www.lohaggo.com/…" value={l.url} onChange={(e) => setOffer({ links: config.offer.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                    <button type="button" onClick={() => setOffer({ links: config.offer.links.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOffer({ links: [...config.offer.links, { label: '', url: '' }] })} className="inline-flex items-center gap-1 text-sm text-primary-700"><Plus size={14} /> Añadir enlace</button>
                <p className="text-xs text-gray-500">A los de lohaggo.com se les añade el seguimiento de la campaña (UTM) automáticamente.</p>
              </div>
              <Field label="Otros dominios permitidos (uno por línea)" hint="Además de lohaggo.com. Un enlace a cualquier otro sitio bloquea la pieza."><Lines value={config.offer.allowedDomains} onChange={(v) => setOffer({ allowedDomains: v })} placeholder="wa.me" rows={2} /></Field>
            </>
          )}

          {options && step === 2 && (
            <>
              <div className="space-y-3">
                <span className="text-sm font-medium text-gray-800">Segmentos</span>
                {config.audience.segments.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 p-3 space-y-2">
                    <div className="flex gap-2">
                      <input className={input} value={s.name} placeholder="Nombre del segmento" onChange={(e) => setAudience({ segments: config.audience.segments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <button type="button" onClick={() => setAudience({ segments: config.audience.segments.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                    <textarea className={input} rows={2} value={s.pains} placeholder="Qué le duele (p. ej. no encuentra a alguien de confianza que llegue a tiempo)" onChange={(e) => setAudience({ segments: config.audience.segments.map((x, j) => (j === i ? { ...x, pains: e.target.value } : x)) })} />
                    <textarea className={input} rows={2} value={s.motivations} placeholder="Qué lo mueve (p. ej. tranquilidad, precio justo, rapidez)" onChange={(e) => setAudience({ segments: config.audience.segments.map((x, j) => (j === i ? { ...x, motivations: e.target.value } : x)) })} />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {SEGMENT_PRESETS.filter((p) => !config.audience.segments.some((s) => s.name === p)).map((p) => (
                    <button key={p} type="button" onClick={() => setAudience({ segments: [...config.audience.segments, { name: p, pains: '', motivations: '' }] })} className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-600 hover:border-primary-400"><Plus size={13} /> {p}</button>
                  ))}
                  <button type="button" onClick={() => setAudience({ segments: [...config.audience.segments, { name: '', pains: '', motivations: '' }] })} className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-600"><Plus size={13} /> Otro</button>
                </div>
              </div>
              <Field label="Objeciones frecuentes (una por línea)" hint="El agente las responde en el contenido."><Lines value={config.audience.objections} onChange={(v) => setAudience({ objections: v })} placeholder={'¿Y si el profesional no llega?\nEs más caro que buscar por mi cuenta'} /></Field>
              <Field label="Qué tanto nos conocen">
                <select className={input} value={config.audience.awareness} onChange={(e) => setAudience({ awareness: e.target.value as AgentConfig['audience']['awareness'] })}>{AWARENESS.map((a) => <option key={a} value={a}>{AWARENESS_LABEL[a]}</option>)}</select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={config.audience.formal} onChange={(e) => setAudience({ formal: e.target.checked })} /> Tratar de usted (por defecto, de tú; español de Colombia)</label>
            </>
          )}

          {options && step === 3 && (
            <>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-800">Tono: 3 adjetivos, con un ejemplo de cada uno</span>
                {[0, 1, 2].map((i) => {
                  const a = config.voice.adjectives[i] ?? { word: '', example: '' }
                  const update = (p: Partial<typeof a>) => { const list = [...config.voice.adjectives]; list[i] = { ...a, ...p }; setVoice({ adjectives: list.filter((x) => x && (x.word || x.example)) }) }
                  return (
                    <div key={i} className="grid gap-2 sm:grid-cols-[160px_1fr]">
                      <input className={input} value={a.word} placeholder={['Cercano', 'Claro', 'Confiable'][i]} onChange={(e) => update({ word: e.target.value })} />
                      <input className={input} value={a.example} placeholder="Ej. «Tranqui, nosotros te ayudamos a encontrar al plomero»" onChange={(e) => update({ example: e.target.value })} />
                    </div>
                  )
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Palabras o expresiones prohibidas" hint="Una por línea. Bloquean la pieza."><Lines value={config.voice.bannedWords} onChange={(v) => setVoice({ bannedWords: v })} placeholder={'barato\nel mejor del mercado'} /></Field>
                <Field label="Temas prohibidos" hint="Una por línea. Bloquean la pieza."><Lines value={config.voice.bannedTopics} onChange={(v) => setVoice({ bannedTopics: v })} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {CHANNELS.map((ch) => (
                  <Field key={ch} label={`Emojis en ${CHANNEL_NAME[ch]}`}>
                    <select className={input} value={config.voice.emojis[ch]} onChange={(e) => setVoice({ emojis: { ...config.voice.emojis, [ch]: e.target.value as 'none' } })}>
                      <option value="none">Ninguno</option><option value="few">Pocos</option><option value="moderate">Con moderación</option>
                    </select>
                  </Field>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hashtags de marca" hint="Siempre van en Instagram. Separados por espacio."><input className={input} defaultValue={config.voice.brandHashtags.join(' ')} onBlur={(e) => setVoice({ brandHashtags: e.target.value.split(/[\s,]+/).filter(Boolean) })} /></Field>
                <Field label="Llamada a la acción preferida"><input className={input} value={config.voice.cta} onChange={(e) => setVoice({ cta: e.target.value })} placeholder="Ej. Pide tu servicio en lohaggo.com" /></Field>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-800">Publicaciones que te gustan</span>
                <p className="text-xs text-gray-500">El agente imita su estilo, no su contenido. Pega textos o elige publicaciones ya publicadas.</p>
                {config.voice.examples.map((ex, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea className={input} rows={3} value={ex} onChange={(e) => setVoice({ examples: config.voice.examples.map((x, j) => (j === i ? e.target.value : x)) })} />
                    <button type="button" onClick={() => setVoice({ examples: config.voice.examples.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                ))}
                {config.voice.examples.length < 5 && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setVoice({ examples: [...config.voice.examples, ''] })} className="inline-flex items-center gap-1 text-sm text-primary-700"><Plus size={14} /> Pegar un texto</button>
                    {options.examples.length > 0 && (
                      <select className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm" value="" onChange={(e) => { const ex = options.examples.find((x) => x.id === e.target.value); if (ex) setVoice({ examples: [...config.voice.examples, ex.body] }) }}>
                        <option value="">Elegir una publicada…</option>
                        {options.examples.map((ex) => <option key={ex.id} value={ex.id}>{CHANNEL_NAME[ex.channel]} · {ex.title.slice(0, 60)}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {options && step === 4 && (
            <>
              {CHANNELS.map((ch) => {
                const plan = config.channels[ch]
                const chAccounts = accounts.filter((a) => a.channel === ch)
                return (
                  <div key={ch} className={`rounded-2xl border p-4 space-y-3 ${plan.enabled ? 'border-gray-200' : 'border-gray-100 bg-gray-50/60'}`}>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 font-medium text-gray-900"><input type="checkbox" checked={plan.enabled} onChange={(e) => setChannel(ch, { enabled: e.target.checked })} /><MkChannelIcon channel={ch} size={18} /> {CHANNEL_NAME[ch]}</label>
                      {plan.enabled && <label className="ml-auto flex items-center gap-2 text-sm text-gray-600"><input type="number" min={1} max={14} className="w-16 rounded-lg border border-gray-200 px-2 py-1" value={plan.perWeek} onChange={(e) => setChannel(ch, { perWeek: Number(e.target.value) })} /> por semana</label>}
                    </div>
                    {plan.enabled && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {AGENT_FORMATS[ch].map((f) => <Toggle key={f} on={plan.formats.includes(f)} onClick={() => setChannel(ch, { formats: plan.formats.includes(f) ? plan.formats.filter((x) => x !== f) : [...plan.formats, f] })}>{FORMAT_LABEL[f] ?? f}</Toggle>)}
                          {ch === 'INSTAGRAM' && <span className="self-center text-xs text-gray-400">Reels: solo si subes un video tú.</span>}
                        </div>
                        {ch !== 'WEB' && (
                          chAccounts.length === 0 ? <p className="text-xs text-amber-700">No hay cuentas de {CHANNEL_NAME[ch]} conectadas en este workspace.</p> : (
                            <div className="space-y-1">
                              <span className="text-xs text-gray-500">Cuentas (ninguna marcada = todas las sanas)</span>
                              {chAccounts.map((a) => (
                                <label key={a.id} className={`flex items-center gap-2 text-sm ${a.ok ? 'text-gray-700' : 'text-gray-400'}`}>
                                  <input type="checkbox" disabled={!a.ok} checked={plan.accountIds.includes(a.id)} onChange={() => setChannel(ch, { accountIds: plan.accountIds.includes(a.id) ? plan.accountIds.filter((x) => x !== a.id) : [...plan.accountIds, a.id] })} />
                                  {a.name}{a.problem && <span className="text-xs text-amber-700">· {a.problem}</span>}
                                </label>
                              ))}
                            </div>
                          )
                        )}
                      </>
                    )}
                  </div>
                )
              })}
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-800">Días permitidos</span>
                <div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <Toggle key={d} on={config.schedule.days.includes(i)} onClick={() => setSchedule({ days: config.schedule.days.includes(i) ? config.schedule.days.filter((x) => x !== i) : [...config.schedule.days, i].sort() })}>{d}</Toggle>)}</div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-800">Franjas permitidas (hora de Bogotá)</span>
                {config.schedule.windows.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    De <input type="number" min={0} max={23} className="w-16 rounded-lg border border-gray-200 px-2 py-1" value={w.from} onChange={(e) => setSchedule({ windows: config.schedule.windows.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)) })} />
                    a <input type="number" min={1} max={24} className="w-16 rounded-lg border border-gray-200 px-2 py-1" value={w.to} onChange={(e) => setSchedule({ windows: config.schedule.windows.map((x, j) => (j === i ? { ...x, to: Number(e.target.value) } : x)) })} /> h
                    {config.schedule.windows.length > 1 && <button type="button" onClick={() => setSchedule({ windows: config.schedule.windows.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}
                  </div>
                ))}
                {config.schedule.windows.length < 4 && <button type="button" onClick={() => setSchedule({ windows: [...config.schedule.windows, { from: 18, to: 21 }] })} className="inline-flex items-center gap-1 text-sm text-primary-700"><Plus size={14} /> Otra franja</button>}
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Silencio desde"><input type="number" min={0} max={23} className={input} value={config.schedule.quietFrom} onChange={(e) => setSchedule({ quietFrom: Number(e.target.value) })} /></Field>
                <Field label="hasta"><input type="number" min={0} max={23} className={input} value={config.schedule.quietTo} onChange={(e) => setSchedule({ quietTo: Number(e.target.value) })} /></Field>
                <Field label="Separación mínima (h)" hint="Entre piezas del mismo canal"><input type="number" min={1} max={72} className={input} value={config.schedule.minGapHours} onChange={(e) => setSchedule({ minGapHours: Number(e.target.value) })} /></Field>
                <Field label="Máx. por día y canal"><input type="number" min={1} max={5} className={input} value={config.schedule.maxPerDay} onChange={(e) => setSchedule({ maxPerDay: Number(e.target.value) })} /></Field>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-800"><input type="radio" className="mt-1" checked={config.schedule.smart} onChange={() => setSchedule({ smart: true })} /><span><strong>El agente elige la mejor hora.</strong> Empieza con los horarios que mejor funcionan en Colombia y, desde 8 publicaciones medidas, usa tus resultados (probando de vez en cuando otras franjas).</span></label>
                <label className="flex items-start gap-2 text-sm text-gray-800"><input type="radio" className="mt-1" checked={!config.schedule.smart} onChange={() => setSchedule({ smart: false })} /><span><strong>Usar mis horarios.</strong> Solo tus franjas, en orden.</span></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Horizonte de planificación (días)" hint="Cuánto calendario mantiene lleno por delante."><input type="number" min={3} max={30} className={input} value={settings.horizonDays} onChange={(e) => setSettings({ ...settings, horizonDays: Number(e.target.value) })} /></Field>
                <Field label="No repetir servicio y ángulo en (días)"><input type="number" min={0} max={120} className={input} value={config.schedule.repeatDays} onChange={(e) => setSchedule({ repeatDays: Number(e.target.value) })} /></Field>
              </div>
            </>
          )}

          {options && step === 5 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(MODE_INFO) as Array<keyof typeof MODE_INFO>).map((m) => {
                  const locked = m !== 'copilot' && !canPublish
                  return (
                    <button key={m} type="button" disabled={locked} onClick={() => setSettings({ ...settings, mode: m })} className={`rounded-2xl border p-4 text-left ${settings.mode === m ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300'} ${locked ? 'opacity-50' : ''}`}>
                      <p className="font-semibold text-gray-900">{MODE_INFO[m].label}</p>
                      <p className="mt-1 text-xs text-gray-600">{m === 'copilot' ? 'Cada pieza requiere tu clic de aprobación.' : m === 'supervised' ? `Se programa sola y te avisa con ${settings.optOutHours} h de margen para cancelarla o editarla.` : 'Publica sola. Las piezas dudosas igual van a revisión.'}</p>
                      {locked && <p className="mt-1 text-[11px] text-amber-700">Requiere permiso de publicar</p>}
                    </button>
                  )
                })}
              </div>
              {settings.mode === 'supervised' && (
                <Field label="Margen para cancelar (horas)" hint="De 2 a 72. La pieza sale a su hora si nadie la cancela o edita antes."><input type="number" min={2} max={72} className={input} value={settings.optOutHours} onChange={(e) => setSettings({ ...settings, optOutHours: Number(e.target.value) })} /></Field>
              )}
              {settings.mode !== 'copilot' && (
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-800">Más control en algún canal (opcional)</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {CHANNELS.filter((ch) => config.channels[ch].enabled).map((ch) => (
                      <label key={ch} className="flex items-center gap-2 text-sm text-gray-700">
                        <MkChannelIcon channel={ch} size={16} />
                        <select className="flex-1 rounded-xl border border-gray-200 px-2 py-1.5 text-sm" value={settings.modeByChannel?.[ch] ?? ''} onChange={(e) => {
                          const next = { ...(settings.modeByChannel ?? {}) }
                          if (e.target.value) next[ch] = e.target.value as 'copilot'
                          else delete next[ch]
                          setSettings({ ...settings, modeByChannel: Object.keys(next).length ? next : null })
                        }}>
                          <option value="">Igual que el agente</option>
                          <option value="copilot">Copiloto</option>
                          {settings.mode === 'autopilot' && <option value="supervised">Supervisado</option>}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Período de prueba (piezas)" hint="Las primeras van en copiloto aunque elijas otro modo."><input type="number" min={0} max={50} className={input} value={settings.trialPostsRemaining} onChange={(e) => setSettings({ ...settings, trialPostsRemaining: Number(e.target.value) })} /></Field>
                <Field label="Confianza mínima" hint="Por debajo, la pieza va a revisión aunque sea piloto."><input type="number" min={0.3} max={0.95} step={0.05} className={input} value={settings.confidenceThreshold} onChange={(e) => setSettings({ ...settings, confidenceThreshold: Number(e.target.value) })} /></Field>
                <Field label="Exploración (%)" hint="Piezas que prueban algo nuevo para aprender."><input type="number" min={0} max={60} className={input} value={Math.round(settings.exploreRatio * 100)} onChange={(e) => setSettings({ ...settings, exploreRatio: Number(e.target.value) / 100 })} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Imágenes">
                  <select className={input} value={config.images.source} onChange={(e) => set('images', { ...config.images, source: e.target.value as AgentConfig['images']['source'] })}>
                    <option value="pexels">Fotos de Pexels del servicio</option>
                    <option value="ai">Generadas con IA (si está configurada; si no, Pexels)</option>
                    <option value="manual">Las subo yo</option>
                  </select>
                </Field>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-700"><input type="checkbox" checked={config.images.logo} onChange={(e) => set('images', { ...config.images, logo: e.target.checked })} /> Poner siempre el logo (del kit de marca)</label>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={config.notify.email} onChange={(e) => set('notify', { email: e.target.checked })} /> Avisar también por correo a quienes pueden publicar en el workspace</label>
              {needsConfirm && (
                <label className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                  <span><AlertTriangle size={14} className="inline mr-1" />Entiendo que en modo {MODE_INFO[settings.mode].label.toLowerCase()} el agente publica en nombre de la marca sin que alguien apruebe cada pieza (después del período de prueba). Queda registrado.</span>
                </label>
              )}
            </>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 p-4">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={15} /> Atrás</button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => save(step + 1)} disabled={saving || (!campaignId && !campaign.name.trim())} className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving && <Loader2 size={15} className="animate-spin" />} Guardar y seguir <ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={() => save('finish')} disabled={saving || (needsConfirm && !confirm)} className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {existing?.agent.strategy ? 'Guardar' : 'Guardar y proponer estrategia'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
