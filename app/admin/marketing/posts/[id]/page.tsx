'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Plus, Trash2, X } from 'lucide-react'
import { validateVariant } from '@/lib/marketing/channel-rules'
import { CHANNEL_NAME, MK_CHANNELS, MkChannelIcon, ReviewChip, StatusChip, api, type Account, type MkChannel } from '@/components/admin/marketing/shared'
import ChannelEditor from '@/components/admin/marketing/editor/ChannelEditor'
import MediaManager from '@/components/admin/marketing/editor/MediaManager'
import CopilotPanel from '@/components/admin/marketing/editor/CopilotPanel'
import PublishPanel from '@/components/admin/marketing/editor/PublishPanel'
import AgentPanel, { type AgentIdea } from '@/components/admin/marketing/editor/AgentPanel'
import ReviewPanel from '@/components/admin/marketing/editor/ReviewPanel'
import type { Media, Post, ReviewRow, Validation, Variant } from '@/components/admin/marketing/editor/types'

type Detail = { post: Post; campaigns: Array<{ id: string; name: string; color: string }>; accounts: Account[]; permissions: { edit: boolean; publish: boolean }; idea?: AgentIdea | null; agent?: { id: string; mode: string; status: string } | null; reviews?: ReviewRow[] }

const VARIANT_FIELDS: Array<keyof Variant> = ['body', 'format', 'linkUrl', 'mediaIds', 'slug', 'seoTitle', 'seoDescription', 'excerpt', 'coverUrl', 'category', 'tags', 'canonicalUrl', 'noindex', 'aiGenerated']
const LOCKED = ['publishing']

function mediaInfo(post: Post, v: Variant) {
  const list = v.mediaIds.length ? v.mediaIds.map((id) => post.media.find((m) => m.id === id)).filter((m): m is Media => Boolean(m)) : post.media
  return list.map((m) => ({ kind: m.kind, mime: m.mime, bytes: m.bytes, width: m.width, height: m.height, durationSec: m.durationSec }))
}

export default function PostEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<MkChannel | null>(null)
  // Local edits: post fields and one draft per channel
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [drafts, setDrafts] = useState<Partial<Record<MkChannel, Variant>>>({})
  const [dirty, setDirty] = useState<{ post: boolean; channels: MkChannel[] }>({ post: false, channels: [] })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [issues, setIssues] = useState<Array<{ channel: string; account?: string; message: string }> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const version = useRef(0)

  const adopt = useCallback((post: Post, keepLocal = false) => {
    setDetail((d) => (d ? { ...d, post } : d))
    if (!keepLocal) {
      setTitle(post.title)
      setBrief(post.brief || '')
      setDrafts(Object.fromEntries(post.variants.map((v) => [v.channel, v])) as Partial<Record<MkChannel, Variant>>)
    }
    setTab((t) => t && post.variants.some((v) => v.channel === t) ? t : post.variants[0]?.channel ?? null)
  }, [])

  const load = useCallback(async () => {
    try {
      const d = await api<Detail>(`/api/admin/marketing/posts/${id}`)
      setDetail(d)
      adopt(d.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar')
    }
  }, [id, adopt])
  useEffect(() => { load() }, [load])

  const post = detail?.post
  const editable = Boolean(detail?.permissions.edit) && !!post && !LOCKED.includes(post.status)

  // Live validation of what is on screen (the server validates again before publishing)
  const validations = useMemo(() => {
    const out: Partial<Record<MkChannel, Validation>> = {}
    if (!post) return out
    for (const v of Object.values(drafts)) {
      if (!v) continue
      out[v.channel] = validateVariant(v.channel, { body: v.body, format: v.format, linkUrl: v.linkUrl, media: mediaInfo(post, v), title, slug: v.slug, seoTitle: v.seoTitle, seoDescription: v.seoDescription, coverUrl: v.coverUrl })
    }
    return out
  }, [drafts, post, title])

  const save = useCallback(async () => {
    if (!post || (!dirty.post && !dirty.channels.length)) return post
    const v0 = ++version.current
    setSaveState('saving')
    const body: Record<string, unknown> = {}
    if (dirty.post) Object.assign(body, { title: title.trim() || 'Publicación sin título', brief })
    if (dirty.channels.length) {
      body.variants = dirty.channels.map((ch) => {
        const d = drafts[ch]!
        return { channel: ch, ...Object.fromEntries(VARIANT_FIELDS.map((f) => [f, d[f]])) }
      })
    }
    try {
      const d = await api<{ post: Post; reviews?: ReviewRow[] }>(`/api/admin/marketing/posts/${id}`, { method: 'PATCH', json: body })
      // Typing continued during the save: keep the newer local text
      const untouched = v0 === version.current
      if (untouched) setDirty({ post: false, channels: [] })
      adopt(d.post, !untouched)
      if (d.reviews) setDetail((x) => (x ? { ...x, reviews: d.reviews } : x))
      setSaveState('saved')
      return d.post
    } catch (err) {
      setSaveState('error')
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      return null
    }
  }, [post, dirty, title, brief, drafts, id, adopt])

  // Autosave 1.5 s after the last change
  useEffect(() => {
    if (!dirty.post && !dirty.channels.length) return
    const t = setTimeout(() => { save() }, 1500)
    return () => clearTimeout(t)
  }, [dirty, title, brief, drafts, save])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.post || dirty.channels.length) { e.preventDefault() } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const touchPost = () => { version.current++; setDirty((d) => ({ ...d, post: true })) }
  const patchVariant = (ch: MkChannel, patch: Partial<Variant>) => {
    version.current++
    setDrafts((d) => ({ ...d, [ch]: { ...d[ch]!, ...patch } }))
    setDirty((d) => ({ ...d, channels: d.channels.includes(ch) ? d.channels : [...d.channels, ch] }))
  }

  async function setStatus(status: string) {
    await save()
    try {
      const d = await api<{ post: Post; reviews?: ReviewRow[]; warning?: string | null }>(`/api/admin/marketing/posts/${id}`, { method: 'PATCH', json: { status } })
      adopt(d.post, true)
      if (d.reviews) setDetail((x) => (x ? { ...x, reviews: d.reviews } : x))
      // Approving may run the editorial review: when it holds the piece, say why
      if (d.warning) setError(d.warning)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function setCampaign(campaignId: string) {
    try {
      const d = await api<{ post: Post }>(`/api/admin/marketing/posts/${id}`, { method: 'PATCH', json: { campaignId: campaignId || null } })
      adopt(d.post, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function addChannel(ch: MkChannel) {
    await save()
    const d = await api<{ post: Post }>(`/api/admin/marketing/posts/${id}`, { method: 'PATCH', json: { variants: [{ channel: ch }] } }).catch((err) => { setError(err.message); return null })
    if (d) { setDrafts((x) => ({ ...x, [ch]: d.post.variants.find((v) => v.channel === ch) })); adopt(d.post, true); setTab(ch) }
  }
  async function removeChannel(ch: MkChannel) {
    if (!window.confirm(`¿Quitar ${CHANNEL_NAME[ch]} de esta publicación? Se borra su texto.`)) return
    const d = await api<{ post: Post }>(`/api/admin/marketing/posts/${id}`, { method: 'PATCH', json: { removeChannels: [ch] } }).catch((err) => { setError(err.message); return null })
    if (d) { setDrafts((x) => { const n = { ...x }; delete n[ch]; return n }); setDirty((x) => ({ ...x, channels: x.channels.filter((c) => c !== ch) })); adopt(d.post, true) }
  }

  async function publish(mode: 'now' | 'schedule' | 'cancel' | 'unpublish', targets: Array<{ channel: MkChannel; connectionId: string | null }>, when?: string) {
    setPublishing(true)
    setIssues(null)
    setError(null)
    try {
      const saved = await save()
      if (saved === null) return
      const d = await api<{ post: Post }>(`/api/admin/marketing/posts/${id}/publish`, { method: 'POST', json: { mode, targets, when } })
      adopt(d.post, true)
      const failed = d.post.publications.filter((p) => p.status === 'failed')
      setNotice(mode === 'now' ? (failed.length ? null : 'Publicado.') : mode === 'schedule' ? 'Programado.' : mode === 'cancel' ? 'Programación cancelada.' : 'El artículo ya no está en el sitio.')
      if (mode === 'now' && failed.length) setError(`No se pudo publicar en ${failed.map((f) => f.connection?.name || CHANNEL_NAME[f.channel]).join(', ')}: ${failed[0].lastError}`)
      setTimeout(() => setNotice(null), 3000)
    } catch (err) {
      const e = err as Error & { issues?: Array<{ channel: string; account?: string; message: string }> }
      if (e.issues) setIssues(e.issues)
      else setError(e.message)
    } finally {
      setPublishing(false)
    }
  }

  async function remove() {
    const published = post?.publications.some((p) => p.status === 'published')
    if (!window.confirm(published ? 'Ya se publicó en algún canal: se archivará (conserva sus estadísticas). ¿Continuar?' : '¿Eliminar esta publicación?')) return
    await api(`/api/admin/marketing/posts/${id}`, { method: 'DELETE' }).catch(() => null)
    router.push('/admin/marketing')
  }

  if (!detail || !post) {
    return <div className="p-6 flex items-center gap-2 text-gray-500">{error ? <><AlertCircle size={18} /> {error}</> : <><Loader2 className="animate-spin" size={18} /> Cargando…</>}</div>
  }

  const current = tab ? drafts[tab] : undefined
  const missing = MK_CHANNELS.filter((c) => !post.variants.some((v) => v.channel === c))
  const accountFor = (ch: MkChannel) => detail.accounts.find((a) => a.channel === ch)?.name || (ch === 'INSTAGRAM' ? '@lohaggo_' : 'LoHaggo')

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/marketing" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft size={14} /> Publicaciones</Link>
        <StatusChip status={post.status} />
        <ReviewChip status={post.reviewStatus} score={post.reviewScore} />
        {post.origin === 'agent' && <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">🤖 Agente</span>}
        <span className="text-xs text-gray-400">
          {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' && !dirty.post && !dirty.channels.length ? 'Guardado' : dirty.post || dirty.channels.length ? 'Cambios sin guardar' : saveState === 'error' ? 'Error al guardar' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <select className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm" disabled={!detail.permissions.edit} value={post.campaignId || ''} onChange={(e) => setCampaign(e.target.value)}>
            <option value="">Sin campaña</option>
            {detail.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {post.campaign && !detail.campaigns.some((c) => c.id === post.campaign!.id) && <option value={post.campaign.id}>{post.campaign.name}</option>}
          </select>
          {detail.permissions.edit && ['draft', 'failed'].includes(post.status) && <button onClick={() => setStatus('review')} className="rounded-full border border-amber-300 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50">Enviar a revisión</button>}
          {detail.permissions.publish && post.status === 'review' && <button onClick={() => setStatus('approved')} className="rounded-full border border-sky-300 px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-50">Aprobar</button>}
          {detail.permissions.edit && ['review', 'approved'].includes(post.status) && <button onClick={() => setStatus('draft')} className="text-sm text-gray-500 hover:underline">Volver a borrador</button>}
          {detail.permissions.edit && <button onClick={remove} className="text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 size={16} /></button>}
        </div>
      </div>

      <input
        className="w-full bg-transparent text-2xl font-bold text-gray-900 outline-none placeholder:text-gray-300"
        value={title}
        disabled={!editable}
        onChange={(e) => { setTitle(e.target.value); touchPost() }}
        placeholder="Título"
      />
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError(null)}><X size={14} /></button></div>}
      {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} /> {notice}</div>}
      {post.status === 'publishing' && <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm text-blue-800">Se está publicando: la edición se bloquea hasta que termine.</div>}
      {current && current.channel !== 'WEB' && post.publications.some((p) => p.channel === current.channel && p.status === 'published') && (
        <div className="rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-600">Ya publicada en {CHANNEL_NAME[current.channel]}: cambiar el texto aquí no modifica la publicación en la red (Meta no lo permite). Sirve para volver a publicarla.</div>
      )}
      {current?.channel === 'WEB' && current.webPublishedAt && (
        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-xs text-emerald-800">Artículo publicado: los cambios que guardes se ven en el blog al momento.</div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200">
            {post.variants.map((v) => {
              const val = validations[v.channel]
              return (
                <button key={v.channel} onClick={() => setTab(v.channel)} className={`inline-flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === v.channel ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  <MkChannelIcon channel={v.channel} size={16} /> {CHANNEL_NAME[v.channel]}
                  {val && !val.ok && <span className="h-2 w-2 rounded-full bg-red-500" title="Tiene errores" />}
                  {val?.ok && val.warnings.length > 0 && <span className="h-2 w-2 rounded-full bg-amber-400" title="Tiene avisos" />}
                </button>
              )
            })}
            {editable && missing.map((c) => (
              <button key={c} onClick={() => addChannel(c)} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-primary-700 whitespace-nowrap"><Plus size={12} /> {CHANNEL_NAME[c]}</button>
            ))}
          </div>

          {current ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
              <ChannelEditor
                post={{ ...post, title }}
                variant={current}
                validation={validations[current.channel]}
                editable={editable}
                accountName={accountFor(current.channel)}
                onChange={(patch) => patchVariant(current.channel, patch)}
                onTitle={(t) => { setTitle(t); touchPost() }}
              />
              {editable && post.variants.length > 1 && !current.webPublishedAt && !post.publications.some((p) => p.channel === current.channel && p.status === 'published') && (
                <button onClick={() => removeChannel(current.channel)} className="text-xs text-gray-400 hover:text-red-600">Quitar {CHANNEL_NAME[current.channel]} de esta publicación</button>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">Añade un canal para empezar a escribir.</p>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <MediaManager
              post={post} editable={editable} onChange={(p) => adopt(p, true)}
              channel={current?.channel ?? 'INSTAGRAM'} format={current?.format ?? null} text={current?.body ?? ''} brief={brief}
            />
          </div>
        </div>

        <div className="space-y-4">
          {post.origin === 'agent' && detail.agent && (
            <AgentPanel post={post} idea={detail.idea ?? null} agentId={detail.agent.id} canEdit={detail.permissions.edit} onChanged={load} onRejected={() => router.push('/admin/marketing')} />
          )}
          <ReviewPanel
            post={post}
            reviews={detail.reviews ?? []}
            canEdit={detail.permissions.edit}
            canPublish={detail.permissions.publish}
            beforeAction={save}
            onDone={(d) => { adopt(d.post); setDetail((x) => (x ? { ...x, reviews: d.reviews } : x)); setNotice(d.message); setTimeout(() => setNotice(null), 4000) }}
          />
          {detail.permissions.edit && current && (
            <CopilotPanel
              post={{ ...post, title, variants: post.variants.map((v) => drafts[v.channel] ?? v) }}
              channel={current.channel}
              currentText={current.body}
              brief={brief}
              setBrief={(v) => { setBrief(v); touchPost() }}
              onApplyText={(text) => patchVariant(current.channel, { body: text, aiGenerated: true })}
              onAppendText={(text) => patchVariant(current.channel, { body: `${current.body.trimEnd()}\n\n${text}`, aiGenerated: true })}
              onApplySeo={(seo) => patchVariant('WEB', { seoTitle: seo.seoTitle, seoDescription: seo.seoDescription, excerpt: seo.excerpt, tags: seo.tags, ...(drafts.WEB?.webPublishedAt ? {} : { slug: seo.slug }) })}
              onUseIdea={(idea) => { setTitle(idea.title); setBrief(idea.angle ? `${idea.title}. ${idea.angle}` : idea.title); touchPost() }}
            />
          )}
          <PublishPanel post={post} accounts={detail.accounts} validations={validations} canPublish={detail.permissions.publish} busy={publishing} issues={issues} onPublish={publish} />
        </div>
      </div>
    </div>
  )
}
