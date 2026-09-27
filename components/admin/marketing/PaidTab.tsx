'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, Download, Loader2, Megaphone, Plus, Sparkles, XCircle } from 'lucide-react'
import { api, fmtDateTime, input } from '@/components/admin/marketing/shared'
import {
  AD_CTAS,
  AD_DESTINATIONS,
  AD_FORMATS,
  AD_LIMITS,
  AD_OBJECTIVES,
  adUrlParams,
  adWelcomeMessage,
  cloudinaryDownload,
  type AdFormat,
  type AdPackage,
} from '@/lib/marketing/ads-core'

type AdImage = { url: string; originalUrl: string; format: AdFormat; ratio: string; prompt: string; alt: string; purpose: string }
type Draft = {
  id: string
  workspaceId: string
  title: string
  status: 'generating' | 'ready' | 'failed' | 'used' | 'archived'
  input: { service: string | null; city: string | null; objective: keyof typeof AD_OBJECTIVES; destination: keyof typeof AD_DESTINATIONS }
  output: AdPackage | null
  images: AdImage[] | null
  issues: Array<{ message: string; severity: string }> | null
  costUsd: number
  error: string | null
  createdAt: string
  usedAt: string | null
}
type Options = { services: string[]; cities: string[]; campaigns: Array<{ id: string; name: string; workspaceId: string }> }
type Ws = { id: string; name: string; permissions: string[] }

const STATUS: Record<Draft['status'], { label: string; cls: string }> = {
  generating: { label: 'Creando…', cls: 'bg-sky-50 text-sky-700' },
  ready: { label: 'Lista para subir', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Falló', cls: 'bg-rose-50 text-rose-700' },
  used: { label: 'Subida a Meta', cls: 'bg-violet-50 text-violet-700' },
  archived: { label: 'Archivada', cls: 'bg-gray-100 text-gray-500' },
}
const GENDER = { all: 'Todos', women: 'Mujeres', men: 'Hombres' }
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch { /* clipboard blocked */ } }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      {done ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />} {done ? 'Copiado' : label}
    </button>
  )
}

/** One field of the ad as Meta Ads Manager asks it: label, the text, a copy button and its length. */
function Field({ label, text, limit }: { label: string; text: string; limit?: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}{limit ? <span className={`ml-1.5 normal-case ${text.length > limit ? 'text-rose-600' : 'text-gray-400'}`}>{text.length}/{limit}</span> : null}</p>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-gray-900">{text || '—'}</p>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-gray-900">{title}</h3>{action}</div>
      {children}
    </section>
  )
}

type Spend = { id: string; day: string; adSet: string; amountCop: number; note: string | null }
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

/** Daily spend typed from Ads Manager: what Analítica → Origen divides to get the cost per request. */
function SpendSection({ draftId, canEdit }: { draftId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<Spend[] | null>(null)
  const [f, setF] = useState({ day: todayBogota(), adSet: '', amountCop: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api<{ spend: Spend[] }>(`/api/admin/marketing/paid/${draftId}/spend`).then((r) => setRows(r.spend)).catch(() => setRows([])) }, [draftId])
  async function save() {
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ spend: Spend[] }>(`/api/admin/marketing/paid/${draftId}/spend`, { method: 'PUT', json: { day: f.day, adSet: f.adSet, amountCop: Number(f.amountCop.replace(/\D/g, '')) } })
      setRows(r.spend)
      setF((x) => ({ ...x, amountCop: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: string) {
    const r = await api<{ spend: Spend[] }>(`/api/admin/marketing/paid/${draftId}/spend?spendId=${id}`, { method: 'DELETE' }).catch(() => null)
    if (r) setRows(r.spend)
  }
  const total = (rows ?? []).reduce((a, r) => a + r.amountCop, 0)
  return (
    <Section title="Gasto diario" action={<span className="text-sm font-semibold text-gray-900">{cop(total)}</span>}>
      <p className="text-xs text-gray-500">Copia de Ads Manager lo gastado cada día (columna «Importe gastado»). Con esto, Analítica → Origen calcula el costo por solicitud de esta pauta.</p>
      {canEdit && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
          <input type="date" className={input} value={f.day} max={todayBogota()} onChange={(e) => setF({ ...f, day: e.target.value })} />
          <input className={input} placeholder="Conjunto (opcional)" title="Nombre del conjunto en Ads Manager, p. ej. Reparaciones" value={f.adSet} onChange={(e) => setF({ ...f, adSet: e.target.value })} />
          <input className={input} inputMode="numeric" placeholder="Gasto en COP" value={f.amountCop} onChange={(e) => setF({ ...f, amountCop: e.target.value })} />
          <button onClick={save} disabled={busy || !f.amountCop.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Guardar</button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {rows === null ? <Loader2 size={16} className="animate-spin text-gray-400" /> : rows.length === 0 ? <p className="text-sm text-gray-500">Sin gasto cargado.</p> : (
        <ul className="divide-y divide-gray-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 truncate text-gray-700">{r.day}{r.adSet ? ` · ${r.adSet}` : ''}</span>
              <span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums text-gray-900">{cop(r.amountCop)}{canEdit && <button onClick={() => remove(r.id)} className="text-xs font-normal text-gray-400 hover:text-rose-600">Quitar</button>}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function DraftDetail({ d, canEdit, onBack, onChanged }: { d: Draft; canEdit: boolean; onBack: () => void; onChanged: (d: Draft) => void }) {
  const [busy, setBusy] = useState(false)
  const p = d.output
  const params = adUrlParams(d.title, d.id)
  async function setStatus(status: 'used' | 'ready' | 'archived') {
    setBusy(true)
    try {
      const r = await api<{ draft: Draft }>(`/api/admin/marketing/paid/${d.id}`, { method: 'PATCH', json: { status } })
      onChanged(r.draft)
      if (status === 'archived') onBack()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"><ArrowLeft size={15} /> Pautas</button>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[d.status].cls}`}>{STATUS[d.status].label}</span>
        <span className="text-xs text-gray-400">{fmtDateTime(d.createdAt)} · US${d.costUsd.toFixed(2)}</span>
      </div>
      <h2 className="break-words text-xl font-bold text-gray-900 sm:text-2xl">{d.title}</h2>

      {d.status === 'failed' && <p className="flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><XCircle size={16} className="mt-0.5 shrink-0" /> {d.error}</p>}
      {d.error && d.status !== 'failed' && <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {d.error}</p>}
      {!!d.issues?.length && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Revisa antes de pagar</p>
          {d.issues.map((i, n) => <p key={n}>• {i.message}</p>)}
        </div>
      )}

      {p && (
        <>
          <Section title="Estrategia">
            <p className="text-sm text-gray-700">{p.summary}</p>
            <p className="text-sm"><span className="font-semibold text-gray-900">Objetivo en Meta:</span> {p.metaObjective || AD_OBJECTIVES[d.input.objective].meta}</p>
            <p className="text-sm"><span className="font-semibold text-gray-900">Destino:</span> {AD_DESTINATIONS[d.input.destination]}</p>
          </Section>

          <Section title="Público" action={<CopyButton text={[`Ubicaciones: ${p.audience.locations.join(', ')}`, `Edad: ${p.audience.ageMin}–${p.audience.ageMax}`, `Género: ${GENDER[p.audience.gender]}`, `Intereses: ${p.audience.interests.join(', ') || 'Advantage+ (amplio)'}`, p.audience.exclusions.length ? `Excluir: ${p.audience.exclusions.join(', ')}` : ''].filter(Boolean).join('\n')} label="Copiar todo" />}>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-gray-500">Ubicaciones</dt><dd className="text-gray-900">{p.audience.locations.join(', ') || '—'}</dd></div>
              <div><dt className="text-xs text-gray-500">Edad y género</dt><dd className="text-gray-900">{p.audience.ageMin}–{p.audience.ageMax} años · {GENDER[p.audience.gender]}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Intereses</dt><dd className="text-gray-900">{p.audience.interests.join(', ') || 'Advantage+ (público amplio)'}</dd></div>
              {!!p.audience.exclusions.length && <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Excluir</dt><dd className="text-gray-900">{p.audience.exclusions.join(', ')}</dd></div>}
            </dl>
            {p.audience.note && <p className="text-xs text-gray-500">{p.audience.note}</p>}
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Presupuesto sugerido">
              <p className="text-2xl font-bold text-gray-900">{p.budget.dailyCop ? `${cop(p.budget.dailyCop)} / día` : '—'}</p>
              {p.budget.days > 0 && <p className="text-sm text-gray-700">{p.budget.days} días · total {cop(p.budget.dailyCop * p.budget.days)}</p>}
              {p.budget.note && <p className="text-xs text-gray-500">{p.budget.note}</p>}
            </Section>
            <Section title="Ubicaciones del anuncio">
              <ul className="space-y-1 text-sm text-gray-700">{p.placements.map((x, i) => <li key={i}>• {x}</li>)}</ul>
            </Section>
          </div>

          <Section title={`Textos (${p.variants.length} variantes para prueba A/B)`}>
            <div className="space-y-4">
              {p.variants.map((v, i) => (
                <div key={i} className="space-y-2 rounded-2xl border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">Variante {i + 1}{v.angle ? <span className="font-normal text-gray-500"> · {v.angle}</span> : null}</p>
                  <Field label="Texto principal" text={v.primaryText} />
                  {v.primaryText.length > AD_LIMITS.primaryVisible && <p className="text-[11px] text-gray-400">Se ven los primeros {AD_LIMITS.primaryVisible} caracteres antes de «Ver más».</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Título" text={v.headline} limit={AD_LIMITS.headline} />
                    <Field label="Descripción" text={v.description} limit={AD_LIMITS.description} />
                  </div>
                  <p className="text-sm"><span className="text-gray-500">Botón:</span> <span className="font-semibold text-gray-900">{AD_CTAS[v.cta]}</span></p>
                  {v.visualHook && <p className="text-xs text-gray-500">Imagen sugerida: {v.visualHook}</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Imágenes">
            {d.images?.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {d.images.map((img, i) => (
                  <figure key={i} className="space-y-1.5">
                    <img src={img.url} alt={img.alt} className={`w-full rounded-xl bg-gray-100 object-cover ${img.format === 'portrait' ? 'aspect-[4/5]' : img.format === 'square' ? 'aspect-square' : 'aspect-video'}`} />
                    <figcaption className="flex items-center justify-between gap-1 text-[11px] text-gray-500">
                      <span className="truncate">{img.ratio}</span>
                      <a href={cloudinaryDownload(img.url)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-gray-700 hover:bg-gray-50"><Download size={11} /> Bajar</a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">Esta pauta no tiene imágenes.</p>}
          </Section>

          {d.input.destination === 'whatsapp' && (
            <Section title="Mensaje de bienvenida y seguimiento">
              <Field label="Mensaje prellenado del chat" text={adWelcomeMessage(d.id, d.input.service)} />
              <p className="text-xs text-gray-500">En Ads Manager, en «Plantilla de mensaje» → «Mensaje prellenado», pega este texto tal cual. El código del final une el chat, la solicitud y la reserva a esta pauta en Analítica → Origen.</p>
            </Section>
          )}

          {d.input.destination === 'website' && (
            <Section title="Enlace y seguimiento">
              <Field label="Sitio web" text="https://www.lohaggo.com/" />
              <Field label="Parámetros de URL (en «Seguimiento» del anuncio)" text={params} />
              <p className="text-xs text-gray-500">Así las visitas de este anuncio se ven en Resultados separadas por Facebook e Instagram.</p>
            </Section>
          )}

          {(d.status === 'used' || d.status === 'ready') && <SpendSection draftId={d.id} canEdit={canEdit} />}

          <Section title="Cómo subirla a Meta Ads">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">{p.checklist.map((x, i) => <li key={i}>{x}</li>)}</ol>
            <a href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"><Megaphone size={14} /> Abrir Meta Ads Manager</a>
          </Section>

          {!!p.risks.length && (
            <Section title="Riesgos">
              <ul className="space-y-1 text-sm text-gray-700">{p.risks.map((x, i) => <li key={i}>• {x}</li>)}</ul>
            </Section>
          )}
        </>
      )}

      {canEdit && d.status !== 'generating' && (
        <div className="flex flex-wrap gap-2">
          {d.status === 'ready' && <button onClick={() => setStatus('used')} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={15} /> Ya la subí a Meta</button>}
          {d.status === 'used' && <button onClick={() => setStatus('ready')} disabled={busy} className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700">Marcar como pendiente</button>}
          <button onClick={() => setStatus('archived')} disabled={busy} className="rounded-full px-4 py-2 text-sm text-gray-500 hover:underline">Archivar</button>
        </div>
      )}
    </div>
  )
}

function NewDraftForm({ workspace, options, imagesReady, imagesReason, onCreated, onCancel }: { workspace: Ws; options: Options; imagesReady: boolean; imagesReason: string | null; onCreated: (d: Draft) => void; onCancel: () => void }) {
  const [f, setF] = useState({ campaignId: '', service: '', city: '', objective: 'messages', destination: 'whatsapp', offer: '', audience: '', instruction: '', formats: ['portrait', 'square'] as AdFormat[], variants: 3, images: 2 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))
  const images = imagesReady ? f.images : 0
  const imageCount = images * f.formats.length

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ draft: Draft }>('/api/admin/marketing/paid', { method: 'POST', json: { ...f, images, workspaceId: workspace.id } })
      onCreated(r.draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-primary-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Sparkles size={16} className="text-primary-600" /> Nueva pauta</h3>
        <button onClick={onCancel} disabled={busy} className="text-sm text-gray-500 hover:underline">Cancelar</button>
      </div>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-600">Servicio
          <input className={`${input} mt-1`} list="paid-services" value={f.service} onChange={(e) => set({ service: e.target.value })} placeholder="El que mejor encaje" />
          <datalist id="paid-services">{options.services.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="block text-xs text-gray-600">Ciudad
          <select className={`${input} mt-1`} value={f.city} onChange={(e) => set({ city: e.target.value })}>
            <option value="">Todas las del catálogo</option>
            {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-600">Objetivo
          <select className={`${input} mt-1`} value={f.objective} onChange={(e) => set({ objective: e.target.value })}>
            {Object.entries(AD_OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-600">A dónde llegan los clics
          <select className={`${input} mt-1`} value={f.destination} onChange={(e) => set({ destination: e.target.value })}>
            {Object.entries(AD_DESTINATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-600 sm:col-span-2">Oferta o promoción (opcional)
          <input className={`${input} mt-1`} value={f.offer} onChange={(e) => set({ offer: e.target.value })} placeholder="Ej.: 10 % en la primera visita hasta el 30 de octubre" />
        </label>
        <label className="block text-xs text-gray-600 sm:col-span-2">Público o idea (opcional)
          <textarea className={`${input} mt-1`} rows={2} value={f.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Ej.: familias con casa propia en Medellín que preparan la temporada de lluvias" />
        </label>
        <label className="block text-xs text-gray-600 sm:col-span-2">Indicación para el agente (opcional)
          <textarea className={`${input} mt-1`} rows={2} value={f.instruction} onChange={(e) => set({ instruction: e.target.value })} placeholder="Ej.: tono más urgente, sin precios" />
        </label>
        {options.campaigns.filter((c) => c.workspaceId === workspace.id).length > 0 && (
          <label className="block text-xs text-gray-600 sm:col-span-2">Usar la voz y la oferta de la campaña (opcional)
            <select className={`${input} mt-1`} value={f.campaignId} onChange={(e) => set({ campaignId: e.target.value })}>
              <option value="">Ninguna</option>
              {options.campaigns.filter((c) => c.workspaceId === workspace.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="block text-xs text-gray-600">Variantes de texto
          <input type="number" min={1} max={5} className={`${input} mt-1`} value={f.variants} onChange={(e) => set({ variants: Number(e.target.value) })} />
        </label>
        <label className="block text-xs text-gray-600">Imágenes distintas
          <input type="number" min={0} max={4} className={`${input} mt-1`} value={images} disabled={!imagesReady} onChange={(e) => set({ images: Number(e.target.value) })} />
        </label>
        <div className="sm:col-span-2">
          <p className="text-xs text-gray-600">Formatos de imagen</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(Object.keys(AD_FORMATS) as AdFormat[]).map((k) => {
              const on = f.formats.includes(k)
              return (
                <button key={k} type="button" disabled={!imagesReady} onClick={() => set({ formats: on ? f.formats.filter((x) => x !== k) : [...f.formats, k] })} title={AD_FORMATS[k].use}
                  className={`rounded-full border px-3 py-1.5 text-xs ${on ? 'border-primary-300 bg-primary-50 font-semibold text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                  {AD_FORMATS[k].label}
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>
      {!imagesReady && <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Las imágenes con IA están apagadas: {imagesReason}. Actívalas en Ajustes → Marca e imágenes; mientras tanto la pauta sale solo con textos.</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button onClick={submit} disabled={busy || (imagesReady && images > 0 && !f.formats.length)} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? 'Creando la pauta…' : 'Crear pauta'}
        </button>
        <p className="text-xs text-gray-500">{busy ? 'El agente escribe y genera las imágenes: 1 a 3 minutos.' : `${f.variants} textos${imageCount ? ` · ${imageCount} imágenes con IA` : ''}. Todo queda para copiar; nada se publica ni se paga desde aquí.`}</p>
      </div>
    </section>
  )
}

/** Publicaciones y campañas → Pauta: the ad agent writes packages to copy into Meta Ads Manager by hand. */
export default function PaidTab({ workspace, workspaces }: { workspace: Ws | null; workspaces: Ws[] }) {
  const [data, setData] = useState<{ drafts: Draft[]; options: Options; imagesReady: boolean; imagesReason: string | null; canEdit: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const ws = workspace ?? (workspaces.length === 1 ? workspaces[0] : null)

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/admin/marketing/paid${ws ? `?workspaceId=${ws.id}` : ''}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [ws])
  useEffect(() => { load() }, [load])

  if (error) return <p className="text-sm text-rose-600">{error}</p>
  if (!data) return <div className="flex items-center gap-2 py-10 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  const current = data.drafts.find((d) => d.id === open)
  const replace = (d: Draft) => setData((x) => (x ? { ...x, drafts: x.drafts.some((y) => y.id === d.id) ? x.drafts.map((y) => (y.id === d.id ? d : y)) : [d, ...x.drafts] } : x))

  if (current) return <DraftDetail d={current} canEdit={data.canEdit} onBack={() => setOpen(null)} onChanged={replace} />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900"><Megaphone size={17} className="text-primary-600" /> Agente de pauta</h2>
          <p className="mt-1 text-sm text-gray-500">Crea anuncios para Facebook e Instagram con IA: estrategia, público, presupuesto, textos para prueba A/B e imágenes con tu logo. Los copias a Meta Ads Manager; los comentarios y mensajes que dejen en los anuncios llegan a la bandeja y los contesta el agente de IA.</p>
        </div>
        {data.canEdit && ws && !creating && <button onClick={() => setCreating(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={15} /> Nueva pauta</button>}
        {!ws && <p className="text-xs text-amber-700">Elige un workspace arriba para crear pautas.</p>}
      </div>

      {creating && ws && <NewDraftForm workspace={ws} options={data.options} imagesReady={data.imagesReady} imagesReason={data.imagesReason} onCancel={() => setCreating(false)} onCreated={(d) => { replace(d); setCreating(false); setOpen(d.id) }} />}

      {data.drafts.length === 0 && !creating ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">Aún no hay pautas. Crea la primera con «Nueva pauta».</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.drafts.map((d) => (
            <button key={d.id} onClick={() => setOpen(d.id)} className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left hover:border-primary-200 hover:shadow-sm">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">{d.images?.[0] && <img src={d.images[0].url.replace('/image/upload/', '/image/upload/c_fill,w_160,h_200,f_auto/')} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1 space-y-1">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[d.status].cls}`}>{STATUS[d.status].label}</span>
                <p className="line-clamp-2 break-words text-sm font-semibold text-gray-900">{d.title}</p>
                <p className="truncate text-xs text-gray-500">{AD_OBJECTIVES[d.input.objective]?.label} · {fmtDateTime(d.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
