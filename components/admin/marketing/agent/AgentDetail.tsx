'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Bot, Check, CheckCircle2, Clock, Lightbulb, Loader2, Pause, Pencil, Play, RefreshCw, Settings, Sparkles, X, XCircle } from 'lucide-react'
import { CHANNEL_NAME, MkChannelIcon, OBJECTIVES, StatusChip, api, fmtDate, fmtDateTime, input, num } from '@/components/admin/marketing/shared'
import { DIMENSIONS, DIMENSION_LABEL } from '@/lib/marketing/agent-core'
import { AGENT_STATUS, MODE_INFO, RUN_TYPE, type AgentDetailData, type AgentPost, type Idea } from '@/components/admin/marketing/agent/types'

type Section = 'overview' | 'strategy' | 'ideas' | 'approve' | 'upcoming' | 'activity' | 'learning'

const REC_LABEL: Record<string, string> = { pillar_weight: 'Peso de pilar', frequency: 'Frecuencia', format: 'Formato', slot: 'Horario', avoid: 'Evitar', test: 'Probar' }

function countdown(to: string | null) {
  if (!to) return null
  const ms = new Date(to).getTime() - Date.now()
  if (ms <= 0) return 'plazo vencido: saldrá a su hora'
  const h = Math.floor(ms / 3600_000)
  const m = Math.floor((ms % 3600_000) / 60_000)
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h para cancelar` : `${h} h ${m} min para cancelar`
}

function PostCard({ post, children }: { post: AgentPost; children?: React.ReactNode }) {
  const [channel, setChannel] = useState(post.variants[0]?.channel)
  const v = post.variants.find((x) => x.channel === channel)
  const meta = post.agentMeta ?? {}
  const issues = [...(meta.validation ?? []), ...(meta.guardrails ?? []).map((g) => g.message), ...(meta.scheduleProblems ?? [])]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        {post.media[0] && <img src={post.media[0].url.replace('/image/upload/', '/image/upload/c_fill,w_160,h_200,f_auto/')} alt="" className="h-20 w-16 shrink-0 rounded-xl object-cover bg-gray-100" />}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={post.status} />
            {post.pillar && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{post.pillar}</span>}
            {meta.confidence != null && <span className={`text-[11px] ${meta.confidence < 0.7 ? 'text-amber-700' : 'text-gray-500'}`}>Confianza {Math.round(meta.confidence * 100)} %</span>}
          </div>
          <Link href={`/admin/marketing/posts/${post.id}`} className="block font-semibold text-gray-900 hover:text-primary-700">{post.title}</Link>
          {(meta.hypothesis || meta.rationale) && <p className="text-xs text-gray-500">{meta.rationale || meta.hypothesis}</p>}
        </div>
      </div>
      <div className="flex gap-1">
        {post.variants.map((x) => (
          <button key={x.channel} onClick={() => setChannel(x.channel)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${channel === x.channel ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}><MkChannelIcon channel={x.channel} size={12} /> {CHANNEL_NAME[x.channel]}</button>
        ))}
      </div>
      {v && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{v.channel === 'WEB' && v.seoTitle ? `${v.seoTitle}\n\n` : ''}{v.body.slice(0, 1500)}{v.body.length > 1500 ? '…' : ''}</p>}
      {meta.slots?.length ? <p className="text-xs text-gray-600">{meta.slots.map((s) => `${CHANNEL_NAME[s.channel]}: ${s.reason}`).join(' · ')}</p> : null}
      {issues.length > 0 && <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-0.5">{issues.slice(0, 5).map((i, n) => <p key={n} className="flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{i}</p>)}</div>}
      {meta.risks?.length ? <p className="text-xs text-gray-500">Riesgos que vio el agente: {meta.risks.join('; ')}</p> : null}
      {meta.imageError && <p className="text-xs text-amber-700">Imagen: {meta.imageError}</p>}
      {children}
    </div>
  )
}

export default function AgentDetail({ agentId, onBack, onEdit }: { agentId: string; onBack: () => void; onEdit: (d: AgentDetailData) => void }) {
  const [d, setD] = useState<AgentDetailData | null>(null)
  const [section, setSection] = useState<Section>('overview')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [instruction, setInstruction] = useState('')

  const load = () => api<AgentDetailData>(`/api/admin/marketing/agents/${agentId}`).then(setD).catch((e) => setError(e.message))
  useEffect(() => { load() }, [agentId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(action: string, payload: Record<string, unknown> = {}, label = action) {
    setBusy(label)
    setError(null)
    setNotice(null)
    try {
      const r = await api<AgentDetailData>(`/api/admin/marketing/agents/${agentId}/actions`, { method: 'POST', json: { action, ...payload } })
      setD(r)
      if (r.message) setNotice(r.message)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      return false
    } finally {
      setBusy(null)
    }
  }
  async function setStatus(status: 'active' | 'paused') {
    setBusy(status)
    setError(null)
    try {
      setD(await api<AgentDetailData>(`/api/admin/marketing/agents/${agentId}`, { method: 'PATCH', json: { status } }))
      setNotice(status === 'paused' ? 'Agente pausado: lo programado salió de la cola.' : 'Agente trabajando.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  if (!d) return <div className="flex items-center gap-2 py-10 text-gray-500">{error ? <><AlertTriangle size={16} /> {error}</> : <><Loader2 className="animate-spin" size={16} /> Cargando…</>}</div>
  const a = d.agent
  const can = d.permissions
  const proposed = d.ideas.filter((i) => i.status === 'proposed')
  const accepted = d.ideas.filter((i) => i.status === 'accepted')
  const supervised = d.upcoming.filter((p) => p.optOutDeadline && p.status === 'scheduled')
  const latest = d.learnings[0]
  const spentPct = a.monthlyBudgetUsd > 0 ? Math.min(100, Math.round((a.spentUsd / a.monthlyBudgetUsd) * 100)) : 100
  const kpiText = a.kpi.value == null ? '—' : a.kpi.key === 'engagement' ? `${a.kpi.value} %` : num(Math.round(a.kpi.value))

  const SECTIONS: Array<[Section, string, number?]> = [
    ['overview', 'Resumen'], ['strategy', 'Estrategia'], ['ideas', 'Ideas', proposed.length], ['approve', 'Por aprobar', d.toApprove.length],
    ['upcoming', 'Saldrán pronto', d.upcoming.length], ['activity', 'Actividad'], ['learning', 'Aprendizajes'],
  ]

  const ideaRow = (i: Idea) => (
    <label key={i.id} className="flex items-start gap-3 rounded-xl border border-gray-100 px-3 py-2 hover:bg-gray-50">
      {i.status === 'proposed' && can.edit && <input type="checkbox" className="mt-1" checked={selected.includes(i.id)} onChange={() => setSelected((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]))} />}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-gray-900">{i.angle}</p>
        <p className="text-xs text-gray-500">{fmtDate(i.targetDate)} · {i.pillar}{i.service ? ` · ${i.service}` : ''}{i.explore ? ' · prueba' : ''}</p>
        {i.rationale && <p className="text-xs text-gray-600">{i.rationale}</p>}
        {i.rejectedReason && <p className="text-xs text-red-600">Rechazada: {i.rejectedReason}</p>}
      </div>
      <span className="flex gap-1">{i.channels.map((c) => <MkChannelIcon key={c} channel={c} size={14} />)}</span>
      {i.status === 'accepted' && can.edit && (
        <button type="button" onClick={(e) => { e.preventDefault(); act('draft', { ideaId: i.id }, `draft:${i.id}`) }} disabled={Boolean(busy)} className="shrink-0 rounded-full border border-primary-200 px-2.5 py-1 text-xs text-primary-700 hover:bg-primary-50">
          {busy === `draft:${i.id}` ? <Loader2 size={12} className="animate-spin" /> : 'Redactar ya'}
        </button>
      )}
      {i.postId && <Link href={`/admin/marketing/posts/${i.postId}`} className="shrink-0 text-xs text-primary-700 hover:underline">Ver pieza</Link>}
    </label>
  )

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft size={14} /> Agentes</button>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${AGENT_STATUS[a.status].cls}`}>{AGENT_STATUS[a.status].label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MODE_INFO[a.effectiveMode].cls}`}>{MODE_INFO[a.effectiveMode].label}{a.effectiveMode !== a.mode ? ` (configurado: ${MODE_INFO[a.mode].label})` : ''}</span>
            {a.trialPostsRemaining > 0 && a.mode !== 'copilot' && <span className="text-[11px] text-gray-500">Período de prueba: {a.trialPostsRemaining} piezas</span>}
          </div>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900"><span className="h-3 w-3 rounded-full" style={{ background: a.campaign.color }} />{a.campaign.name}</h2>
          <p className="text-sm text-gray-500">{OBJECTIVES[a.campaign.objective] || a.campaign.objective} · {fmtDate(a.campaign.startsAt)} – {a.config.alwaysOn ? 'siempre activa' : fmtDate(a.campaign.endsAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can.edit && <button onClick={() => onEdit(d)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Settings size={15} /> Configuración</button>}
          {can.edit && a.status === 'active' && (
            <button onClick={() => { if (window.confirm('¿Pausar el agente? Lo que tenga programado sale de la cola; lo publicado y los borradores no se tocan.')) setStatus('paused') }} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">
              {busy === 'paused' ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} />} Pausar agente
            </button>
          )}
          {can.edit && (a.status === 'paused' || (a.status === 'draft' && a.strategyApprovedAt)) && (
            <button onClick={() => setStatus('active')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Play size={16} /> {a.status === 'paused' ? 'Reanudar' : 'Activar'}</button>
          )}
        </div>
      </div>

      {a.degradedReason && <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> En copiloto: {a.degradedReason}. Cada pieza espera tu aprobación hasta que se resuelva.</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError(null)}><X size={14} /></button></div>}
      {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} /> {notice}</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {SECTIONS.map(([k, label, n]) => (
          <button key={k} onClick={() => setSection(k)} className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm -mb-px ${section === k ? 'border-primary-600 font-medium text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {label}{n ? <span className="rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">{n}</span> : null}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-500">{a.kpi.label}</p><p className="text-lg font-semibold text-gray-900">{kpiText}{a.kpi.goal != null && <span className="text-sm font-normal text-gray-500"> / {num(a.kpi.goal)}</span>}</p></div>
            <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-500">Publicadas</p><p className="text-lg font-semibold text-gray-900">{a.counts.published}</p></div>
            <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-500">Costo de IA este mes</p><p className="text-lg font-semibold text-gray-900">${a.spentUsd.toFixed(2)} <span className="text-sm font-normal text-gray-500">de ${a.monthlyBudgetUsd}</span></p><div className="mt-1 h-1.5 rounded-full bg-gray-200"><div className={`h-1.5 rounded-full ${spentPct >= 80 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${spentPct}%` }} /></div></div>
            <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-500">Próxima planificación</p><p className="text-sm font-semibold text-gray-900">{a.nextPlanAt ? fmtDateTime(a.nextPlanAt) : a.status === 'active' ? '—' : 'Agente detenido'}</p></div>
          </div>
          {!a.strategy && (
            <div className="rounded-2xl border border-dashed border-primary-300 bg-primary-50/50 p-6 text-center space-y-3">
              <Bot className="mx-auto text-primary-600" />
              <p className="font-medium text-gray-900">El agente aún no tiene estrategia</p>
              <p className="text-sm text-gray-600">La propone a partir del objetivo y de lo que configuraste. Tú la revisas y la apruebas; sin eso no planifica nada.</p>
              {can.edit && <button onClick={() => act('strategy', {}, 'strategy')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700">{busy === 'strategy' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Proponer estrategia</button>}
              {busy === 'strategy' && <p className="text-xs text-gray-500">Puede tardar hasta un minuto.</p>}
            </div>
          )}
          {a.strategy && !a.strategyApprovedAt && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <Lightbulb size={16} /> Hay una estrategia esperando tu aprobación.
              <button onClick={() => setSection('strategy')} className="font-semibold underline">Revisarla</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {[['ideas', 'Ideas por revisar', a.counts.ideasProposed], ['approve', 'Piezas por aprobar', a.counts.toApprove], ['upcoming', 'Programadas', a.counts.upcoming]].map(([k, label, n]) => (
              <button key={String(k)} onClick={() => setSection(k as Section)} className="rounded-2xl border border-gray-200 bg-white p-4 text-left hover:border-primary-200"><p className="text-2xl font-bold text-gray-900">{n}</p><p className="text-sm text-gray-500">{label}</p></button>
            ))}
          </div>
          {d.recent.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Lo último publicado</h3>
              {d.recent.map((p) => (
                <Link key={p.id} href={`/admin/marketing/posts/${p.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 hover:bg-gray-50">
                  <StatusChip status={p.status} /><span className="flex-1 truncate text-sm text-gray-900">{p.title}</span><span className="text-xs text-gray-500">{fmtDateTime(p.publishedAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'strategy' && (
        <div className="space-y-4">
          {!a.strategy ? <p className="text-sm text-gray-500">Aún no hay estrategia.</p> : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {a.strategyApprovedAt ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Aprobada el {fmtDateTime(a.strategyApprovedAt)}</span> : <span className="text-amber-700">Propuesta el {fmtDateTime(a.strategyProposedAt)}: falta aprobarla</span>}
                </div>
                <p className="text-sm text-gray-800">{a.strategy.summary}</p>
                <div className="space-y-2">
                  {a.strategy.pillars.map((p) => (
                    <div key={p.name} className="rounded-xl bg-gray-50 p-3">
                      <div className="flex items-center gap-2"><p className="font-semibold text-gray-900">{p.name}</p><span className="ml-auto text-sm font-bold text-primary-700">{p.weight} %</span></div>
                      <div className="my-1.5 h-1.5 rounded-full bg-gray-200"><div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${p.weight}%` }} /></div>
                      <p className="text-sm text-gray-600">{p.description}</p>
                      {p.services.length > 0 && <p className="mt-1 text-xs text-gray-500">Servicios: {p.services.join(', ')}</p>}
                      {p.angles.length > 0 && <p className="text-xs text-gray-500">Ángulos: {p.angles.join('; ')}</p>}
                    </div>
                  ))}
                </div>
                {a.strategy.keyMessages.length > 0 && <div><p className="text-sm font-semibold text-gray-900">Mensajes clave</p>{a.strategy.keyMessages.map((m) => <p key={m.segment} className="text-sm text-gray-700"><strong>{m.segment}:</strong> {m.message}</p>)}</div>}
                {a.strategy.formatMix.length > 0 && <div><p className="text-sm font-semibold text-gray-900">Formatos</p>{a.strategy.formatMix.map((m) => <p key={m.channel} className="text-sm text-gray-700">{CHANNEL_NAME[m.channel]}: {m.formats.map((f) => `${f.format} ${f.share} %`).join(', ')}</p>)}</div>}
                <div><p className="text-sm font-semibold text-gray-900">KPI</p><p className="text-sm text-gray-700">{a.strategy.kpi.name}: {a.strategy.kpi.target}. {a.strategy.kpi.measurement}</p></div>
                {a.strategy.hypotheses.length > 0 && <div><p className="text-sm font-semibold text-gray-900">Hipótesis a probar</p><ul className="list-disc pl-5 text-sm text-gray-700">{a.strategy.hypotheses.map((h) => <li key={h}>{h}</li>)}</ul></div>}
                {a.strategy.risks.length > 0 && <div><p className="text-sm font-semibold text-gray-900">Riesgos</p><ul className="list-disc pl-5 text-sm text-gray-700">{a.strategy.risks.map((h) => <li key={h}>{h}</li>)}</ul></div>}
                {a.strategy.avoid?.length ? <p className="text-xs text-gray-500">Evitar (aprendido): {a.strategy.avoid.join('; ')}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!a.strategyApprovedAt && can.publish && (
                  <button onClick={() => act('approve_strategy', { activate: true }, 'approve')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{busy === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Aprobar y activar el agente</button>
                )}
                {!a.strategyApprovedAt && !can.publish && <p className="text-sm text-gray-500">La aprueba alguien con permiso de publicar.</p>}
              </div>
            </>
          )}
          {can.edit && (
            <div className="flex flex-wrap gap-2">
              <input className={`${input} max-w-md`} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Indicación para una nueva propuesta (opcional)" />
              <button onClick={() => act('strategy', { instruction }, 'strategy')} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 px-4 py-2 text-sm text-primary-700 hover:bg-primary-50">{busy === 'strategy' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {a.strategy ? 'Proponer otra' : 'Proponer estrategia'}</button>
            </div>
          )}
        </div>
      )}

      {section === 'ideas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm text-gray-500">{a.effectiveMode === 'copilot' ? 'Acepta las ideas que quieras ver redactadas. Al rechazar, di por qué: el agente aprende.' : 'En este modo el agente acepta sus propias ideas; puedes rechazar las que no quieras.'}</p>
            {can.edit && a.strategyApprovedAt && <button onClick={() => act('plan', {}, 'plan')} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{busy === 'plan' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} Planificar ahora</button>}
          </div>
          {proposed.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900">Por revisar ({proposed.length})</h3>
                {can.edit && (
                  <>
                    <button onClick={() => setSelected(selected.length === proposed.length ? [] : proposed.map((i) => i.id))} className="text-xs text-primary-700 hover:underline">{selected.length === proposed.length ? 'Ninguna' : 'Todas'}</button>
                    <button onClick={async () => { if (await act('ideas', { ids: selected, decision: 'accept' }, 'accept')) setSelected([]) }} disabled={!selected.length || Boolean(busy)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"><Check size={13} /> Aceptar</button>
                    <button onClick={async () => { const reason = window.prompt('¿Por qué no? (el agente lo tendrá en cuenta)'); if (reason !== null && await act('ideas', { ids: selected, decision: 'reject', reason }, 'reject')) setSelected([]) }} disabled={!selected.length || Boolean(busy)} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40"><X size={13} /> Rechazar</button>
                  </>
                )}
              </div>
              {proposed.map(ideaRow)}
            </div>
          )}
          {accepted.length > 0 && <div className="space-y-2"><h3 className="font-semibold text-gray-900">Aceptadas, por redactar ({accepted.length})</h3><p className="text-xs text-gray-500">Se redactan solas unos días antes de su fecha.</p>{accepted.map(ideaRow)}</div>}
          {d.ideas.filter((i) => i.status === 'drafted' || i.status === 'rejected').length > 0 && (
            <details className="space-y-2"><summary className="cursor-pointer text-sm text-gray-500">Redactadas y rechazadas</summary>{d.ideas.filter((i) => i.status === 'drafted' || i.status === 'rejected').map(ideaRow)}</details>
          )}
          {!d.ideas.length && <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">{a.strategyApprovedAt ? 'Aún no hay ideas: el agente planifica en su próxima ejecución (cada 30 min revisa si hay huecos).' : 'Aprueba la estrategia para que el agente empiece a planificar.'}</p>}
        </div>
      )}

      {section === 'approve' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {d.toApprove.length === 0 && <p className="text-sm text-gray-500">Nada esperando aprobación.</p>}
          {d.toApprove.map((p) => (
            <PostCard key={p.id} post={p}>
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                {can.publish && p.status === 'review' && <button onClick={() => act('approve_post', { postId: p.id }, `ok:${p.id}`)} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">{busy === `ok:${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprobar</button>}
                <Link href={`/admin/marketing/posts/${p.id}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700"><Pencil size={12} /> Editar</Link>
                {can.edit && <button onClick={() => { const i = window.prompt('¿Qué quieres que cambie?'); if (i) act('redraft', { postId: p.id, instruction: i }, `re:${p.id}`) }} disabled={Boolean(busy)} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700">{busy === `re:${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Pedir otra versión</button>}
                {can.edit && <button onClick={() => { const r = window.prompt('¿Por qué la rechazas? (el agente aprende)'); if (r) act('reject_post', { postId: p.id, reason: r }, `no:${p.id}`) }} disabled={Boolean(busy)} className="ml-auto inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><XCircle size={12} /> Rechazar</button>}
              </div>
            </PostCard>
          ))}
        </div>
      )}

      {section === 'upcoming' && (
        <div className="space-y-3">
          {supervised.length > 0 && <p className="text-sm text-gray-600">En modo supervisado cada pieza sale sola si nadie la cancela o la edita antes de su plazo.</p>}
          {d.upcoming.length === 0 && <p className="text-sm text-gray-500">Nada programado.</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {d.upcoming.map((p) => (
              <PostCard key={p.id} post={p}>
                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs">
                  {p.status === 'scheduled' && <span className="inline-flex items-center gap-1 text-violet-700"><Clock size={12} /> Sale {fmtDateTime(p.scheduledAt)}</span>}
                  {p.optOutDeadline && p.status === 'scheduled' && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{countdown(p.optOutDeadline)}</span>}
                  {p.status === 'approved' && <span className="text-gray-500">{p.agentMeta?.hold ? 'Fuera de la cola (la cancelaste): prográmala en el editor' : 'Esperando franja'}</span>}
                  <Link href={`/admin/marketing/posts/${p.id}`} className="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-gray-700"><Pencil size={12} /> Editar</Link>
                  {can.edit && p.status === 'scheduled' && (
                    <>
                      <button onClick={() => { if (window.confirm('¿Sacarla de la cola? Queda aprobada y no sale hasta que la programes.')) act('cancel_post', { postId: p.id }, `c:${p.id}`) }} disabled={Boolean(busy)} className="rounded-full border border-red-200 px-3 py-1.5 text-red-700">Cancelar</button>
                      <button onClick={() => { const r = window.prompt('¿Por qué la descartas? (el agente aprende)'); if (r !== null) act('cancel_post', { postId: p.id, discard: true, reason: r }, `d:${p.id}`) }} disabled={Boolean(busy)} className="text-red-600 hover:underline">Descartar</button>
                    </>
                  )}
                </div>
              </PostCard>
            ))}
          </div>
        </div>
      )}

      {section === 'activity' && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-3 py-2">Cuándo</th><th className="px-3 py-2">Qué</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2 text-right">Costo</th></tr></thead>
            <tbody>
              {d.runs.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">{fmtDateTime(r.startedAt)}</td>
                  <td className="px-3 py-2 text-gray-800">{RUN_TYPE[r.type] ?? r.type}</td>
                  <td className="px-3 py-2">{r.status === 'error' ? <span className="text-red-600">{r.error}</span> : r.status === 'running' ? <span className="text-blue-700">En curso…</span> : <span className={r.status === 'skipped' ? 'text-gray-500' : 'text-gray-800'}>{r.summary}</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-gray-500" title={r.tokensIn ? `${num(r.tokensIn)} tokens de entrada · ${num(r.tokensOut)} de salida${r.model ? ` · ${r.model}` : ''}` : undefined}>{r.costUsd ? `$${r.costUsd.toFixed(3)}` : '—'}</td>
                </tr>
              ))}
              {!d.runs.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Sin actividad todavía.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {section === 'learning' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm text-gray-500">Cada semana el agente compara los resultados (con 48 h de vida) por pilar, formato, franja y servicio, y ajusta. {a.mode === 'autopilot' ? 'En piloto automático aplica sus recomendaciones solo, dentro de los límites.' : 'Sus recomendaciones esperan tu aprobación.'}</p>
            {can.edit && <button onClick={() => act('learn', {}, 'learn')} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{busy === 'learn' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Analizar ahora</button>}
          </div>
          {!latest ? <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">Aún no hay aprendizajes: hacen falta al menos 3 envíos con 48 h publicados.</p> : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
                <p className="text-xs text-gray-500">{fmtDate(latest.periodStart)} – {fmtDate(latest.periodEnd)} · {latest.sampleSize} envíos medidos</p>
                <div className="whitespace-pre-wrap text-sm text-gray-800">{latest.insights}</div>
                {latest.recommendations.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">Recomendaciones {latest.applied && <span className="text-xs font-normal text-emerald-700">· aplicadas {fmtDateTime(latest.appliedAt)}</span>}</p>
                    {latest.recommendations.map((r, i) => {
                      const x = r as unknown as Record<string, string | number>
                      const what = x.type === 'pillar_weight' ? `${x.pillar} → ${x.weight} %` : x.type === 'frequency' ? `${CHANNEL_NAME[x.channel as 'WEB']}: ${x.perWeek}/semana` : x.type === 'format' ? `${CHANNEL_NAME[x.channel as 'WEB']}: ${x.direction === 'more' ? 'más' : 'menos'} ${x.format}` : x.type === 'slot' ? `${CHANNEL_NAME[x.channel as 'WEB']}: ${x.note}` : x.type === 'avoid' ? String(x.topic) : String(x.idea)
                      return <p key={i} className="text-sm text-gray-700"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{REC_LABEL[String(x.type)]}</span> {what} <span className="text-xs text-gray-500">— {x.reason}</span></p>
                    })}
                    {!latest.applied && can.publish && <button onClick={() => act('apply_learning', { learningId: latest.id }, 'apply')} disabled={Boolean(busy)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white">{busy === 'apply' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aplicar recomendaciones</button>}
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DIMENSIONS.filter((dim) => latest.metricsByDimension.byDimension?.[dim]?.length).map((dim) => (
                  <div key={dim} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="mb-2 text-sm font-semibold text-gray-900">{DIMENSION_LABEL[dim]}</p>
                    {latest.metricsByDimension.byDimension[dim].slice(0, 6).map((x) => (
                      <div key={x.value} className="flex items-center gap-2 text-sm">
                        <span className="w-32 truncate text-gray-700">{x.value.replace(/^(WEB|INSTAGRAM|FACEBOOK):/, (m) => `${CHANNEL_NAME[m.slice(0, -1) as 'WEB']} · `)}</span>
                        <div className="h-2 flex-1 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${x.smoothedLift >= 1 ? 'bg-emerald-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, x.smoothedLift * 50)}%` }} /></div>
                        <span className="w-20 text-right text-xs text-gray-500">{x.smoothedLift.toFixed(2)}× ({x.n}){x.lowData ? '*' : ''}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">1× = la media de la cuenta en ese canal. * pocos datos (menos de 3): el valor se acerca a la media a propósito.</p>
            </>
          )}
          {d.learnings.length > 1 && <details><summary className="cursor-pointer text-sm text-gray-500">Semanas anteriores</summary>{d.learnings.slice(1).map((l) => <div key={l.id} className="mt-2 rounded-xl bg-gray-50 p-3 text-sm whitespace-pre-wrap text-gray-700"><p className="text-xs text-gray-500">{fmtDate(l.periodStart)} – {fmtDate(l.periodEnd)}</p>{l.insights}</div>)}</details>}
        </div>
      )}
      <p className="text-[11px] text-gray-400">Horario de Bogotá. El agente revisa cada 30 minutos.</p>
    </div>
  )
}
