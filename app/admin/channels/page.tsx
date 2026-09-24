'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Copy, ExternalLink, Facebook, Instagram, Loader2, Pause, Play,
  RefreshCw, Save, ShieldCheck, Stethoscope, Trash2, XCircle, Inbox, Link2, Eye, EyeOff, KeyRound,
} from 'lucide-react'

type MetaChannel = 'MESSENGER' | 'INSTAGRAM'

type Capabilities = {
  receive: boolean
  send: boolean
  sendDetail?: string
  receiveDetail?: string
  checkedAt: string
  comments?: { required: string[]; missing: string[] | null; feedSubscribed: boolean | null; detail?: string }
} | null

type CommentSettings = { enabled?: boolean; includeAds?: boolean; mentions?: boolean; grantedScopes?: string[] | null; checkedAt?: string | null } | null

type WorkspaceOption = { id: string; name: string; isDefault: boolean; canManage: boolean }

type Connection = {
  id: string
  workspaceId: string
  workspace?: { id: string; name: string } | null
  canManage: boolean
  channel: MetaChannel
  externalId: string
  name: string
  status: 'ACTIVE' | 'ERROR'
  enabled: boolean
  meta?: { pageId?: string; username?: string | null; subscribedFields?: string[]; tokenExpiresAt?: string | null } | null
  capabilities: Capabilities
  commentSettings?: CommentSettings
  lastError?: string | null
  lastEventAt?: string | null
  connectedByEmail?: string | null
  createdAt: string
  _count?: { conversations: number }
}

type MetaAppView = {
  configured: boolean
  appId: string
  appSecret: string
  hasAppSecret: boolean
  verifyToken: string
  graphVersion: string
  configId: string
  canEdit: boolean
}

type Urls = { redirect: string; messenger: string; instagram: string }

type Candidate = { id: string; name: string; pageId: string; username?: string | null; alreadyConnected: boolean; takenByWorkspace?: string | null }

type WebhookEventRow = {
  id: string
  channel: MetaChannel
  externalId?: string | null
  status: 'OK' | 'IGNORED' | 'UNROUTED' | 'PAUSED' | 'BAD_SIGNATURE' | 'ERROR'
  detail?: string | null
  createdAt: string
}

const CHANNEL_LABEL: Record<MetaChannel, string> = { MESSENGER: 'Messenger', INSTAGRAM: 'Instagram' }

const EVENT_STATUS_STYLE: Record<WebhookEventRow['status'], string> = {
  OK: 'bg-green-100 text-green-700',
  IGNORED: 'bg-gray-100 text-gray-600',
  UNROUTED: 'bg-orange-100 text-orange-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  BAD_SIGNATURE: 'bg-red-100 text-red-700',
  ERROR: 'bg-red-100 text-red-700',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function ChannelIcon({ channel, size = 18 }: { channel: MetaChannel; size?: number }) {
  return channel === 'INSTAGRAM'
    ? <Instagram size={size} className="text-pink-600" />
    : <Facebook size={size} className="text-sky-600" />
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700">{value || '—'}</code>
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* noop */ }
          }}
          className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          title="Copiar"
        >
          {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

/** Comments on the account's posts and ads: switches, permission status and the reconnect shortcut. */
function CommentsBox({ conn, busy, onPatch, reconnectHref }: { conn: Connection; busy: boolean; onPatch: (patch: Record<string, boolean>) => void; reconnectHref: string }) {
  const s = conn.commentSettings || {}
  const enabled = s.enabled === true
  const c = conn.capabilities?.comments
  const missing = c?.missing ?? null
  const ro = !conn.canManage || busy
  const Row = ({ checked, label, hint, onChange, disabled }: { checked: boolean; label: string; hint: string; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <label className={`flex items-start gap-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="text-xs font-medium text-gray-800">{label}</span><span className="block text-[11px] text-gray-500">{hint}</span></span>
    </label>
  )
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">Comentarios</span>
        {enabled && missing && missing.length === 0 && <span className="text-[11px] text-green-700">Permisos completos</span>}
      </div>
      <Row
        checked={enabled}
        disabled={ro}
        onChange={(v) => onPatch({ enabled: v })}
        label="Recibir comentarios"
        hint={conn.channel === 'INSTAGRAM' ? 'Comentarios en las publicaciones, reels y anuncios de la cuenta.' : 'Comentarios en las publicaciones y anuncios de la página.'}
      />
      {enabled && (
        <>
          <Row checked={s.includeAds !== false} disabled={ro} onChange={(v) => onPatch({ includeAds: v })} label="Incluir anuncios pagados" hint="Si lo apagas, los comentarios en anuncios no llegan a la bandeja." />
          {conn.channel === 'INSTAGRAM' && (
            <Row checked={s.mentions === true} disabled={ro} onChange={(v) => onPatch({ mentions: v })} label="Menciones" hint="Cuando alguien menciona a la cuenta en una publicación suya. Necesita un permiso adicional." />
          )}
        </>
      )}
      {enabled && missing && missing.length > 0 && (
        <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 space-y-1">
          <p>Faltan permisos en el token: <span className="font-mono">{missing.join(', ')}</span>. Sin ellos no llegan o no se pueden responder los comentarios.</p>
          {conn.canManage && <a href={reconnectHref} className="inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline"><RefreshCw size={11} /> Reconectar con comentarios</a>}
        </div>
      )}
      {enabled && missing === null && (
        <p className="text-[11px] text-gray-500">{c?.detail || 'Pulsa «Diagnosticar» para comprobar los permisos del token.'}</p>
      )}
      {enabled && conn.channel === 'MESSENGER' && c?.feedSubscribed === false && (
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5">La página no está suscrita a «feed»: los comentarios no llegarán. Reconecta con comentarios.</p>
      )}
    </div>
  )
}

function CapChip({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  const cls = ok === null ? 'bg-gray-100 text-gray-500' : ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`} title={detail || ''}>
      {ok === null ? '·' : ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  )
}

export default function ChannelsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [metaApp, setMetaApp] = useState<MetaAppView | null>(null)
  const [urls, setUrls] = useState<Urls | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [selectedWs, setSelectedWs] = useState<string>('')
  const [withComments, setWithComments] = useState(false)
  const [withMentions, setWithMentions] = useState(false)
  const [events, setEvents] = useState<WebhookEventRow[]>([])

  const [form, setForm] = useState({ appId: '', appSecret: '', verifyToken: '', graphVersion: 'v26.0', configId: '' })
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionChannel, setSessionChannel] = useState<MetaChannel | null>(null)
  const [sessionWorkspaceName, setSessionWorkspaceName] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [chRes, evRes] = await Promise.all([fetch('/api/admin/channels'), fetch('/api/admin/channels/events?limit=40')])
      if (!chRes.ok) throw new Error('No se pudo cargar la configuración de canales')
      const data = await chRes.json()
      setMetaApp(data.metaApp)
      setUrls(data.urls)
      setConnections(data.connections || [])
      const ws: WorkspaceOption[] = data.workspaces || []
      setWorkspaces(ws)
      setSelectedWs((prev) => (prev && ws.some((w) => w.id === prev && w.canManage) ? prev : ws.find((w) => w.canManage)?.id || ''))
      setForm((prev) => ({
        ...prev,
        appId: data.metaApp?.appId || '',
        verifyToken: data.metaApp?.verifyToken || '',
        graphVersion: data.metaApp?.graphVersion || 'v26.0',
        configId: data.metaApp?.configId || '',
        appSecret: '',
      }))
      if (evRes.ok) {
        const ev = await evRes.json()
        setEvents(ev.events || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando canales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // OAuth return: ?session=<id> (selection step) or ?oauthError=<msg>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('session')
    const oauthError = params.get('oauthError')
    if (oauthError) setError(`Autorización de Meta falló: ${oauthError}`)
    if (s) setSessionId(s)
    if (s || oauthError) window.history.replaceState({}, '', '/admin/channels')
  }, [])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/channels/oauth/session/${sessionId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) { setSessionError(data.error || 'Sesión inválida'); setCandidates([]); return }
        setSessionChannel(data.session.channel)
        setSessionWorkspaceName(data.session.workspace?.name || null)
        setCandidates(data.candidates || [])
        setSessionError(data.error || null)
        setSelected(new Set((data.candidates || []).filter((c: Candidate) => !c.alreadyConnected && !c.takenByWorkspace).map((c: Candidate) => c.id)))
      } catch {
        if (!cancelled) { setSessionError('No se pudo leer la sesión OAuth'); setCandidates([]) }
      }
    })()
    return () => { cancelled = true }
  }, [sessionId])

  async function saveMetaApp() {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const payload: Record<string, unknown> = {
        provider: 'META_APP',
        appId: form.appId,
        verifyToken: form.verifyToken,
        graphVersion: form.graphVersion,
        configId: form.configId,
      }
      if (form.appSecret) payload.appSecret = form.appSecret
      const res = await fetch('/api/admin/messaging/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setNotice('Configuración de la App de Meta guardada.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  async function completeSelection() {
    if (!sessionId || selected.size === 0) return
    setConnecting(true)
    setSessionError(null)
    try {
      const res = await fetch(`/api/admin/channels/oauth/session/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIds: Array.from(selected) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo conectar')
      const failed = (data.results || []).filter((r: { error?: string }) => r.error)
      setNotice(
        failed.length
          ? `Conectadas ${data.results.length - failed.length} cuenta(s). Con error: ${failed.map((f: { name: string; error: string }) => `${f.name} (${f.error})`).join(', ')}`
          : `¡Listo! ${data.results.length} cuenta(s) de ${CHANNEL_LABEL[data.channel as MetaChannel]} conectada(s).`
      )
      setSessionId(null)
      setCandidates(null)
      await load()
      // Diagnostics run in the background right after connecting; refresh once more shortly after
      setTimeout(() => { load() }, 4000)
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Error al conectar')
    } finally {
      setConnecting(false)
    }
  }

  async function toggleEnabled(conn: Connection) {
    setBusyId(conn.id)
    try {
      const res = await fetch(`/api/admin/channels/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !conn.enabled }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando la conexión')
    } finally {
      setBusyId(null)
    }
  }

  async function patchComments(conn: Connection, patch: Record<string, boolean>) {
    setBusyId(conn.id)
    try {
      const res = await fetch(`/api/admin/channels/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentSettings: patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error')
      if (data.warning) setError(data.warning)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando los comentarios')
    } finally {
      setBusyId(null)
    }
  }

  async function diagnose(conn: Connection) {
    setBusyId(conn.id)
    try {
      const res = await fetch(`/api/admin/channels/${conn.id}/diagnose`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error en diagnóstico')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en diagnóstico')
    } finally {
      setBusyId(null)
    }
  }

  async function disconnect(conn: Connection) {
    if (!window.confirm(`¿Desconectar "${conn.name}"? Las conversaciones existentes se conservan, pero dejarás de recibir y enviar mensajes por esta cuenta.`)) return
    setBusyId(conn.id)
    try {
      const res = await fetch(`/api/admin/channels/${conn.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconectando')
    } finally {
      setBusyId(null)
    }
  }

  const configured = Boolean(metaApp?.configured)
  const canEditApp = Boolean(metaApp?.canEdit)
  const manageableWs = workspaces.filter((w) => w.canManage)
  const canConnect = configured && Boolean(selectedWs)
  const connectHref = (channel: 'messenger' | 'instagram') =>
    `/api/admin/channels/oauth/start?channel=${channel}&workspaceId=${encodeURIComponent(selectedWs)}${withComments ? '&comments=1' : ''}${withComments && withMentions && channel === 'instagram' ? '&mentions=1' : ''}`
  const reconnectHref = (conn: Connection) =>
    `/api/admin/channels/oauth/start?channel=${conn.channel.toLowerCase()}&workspaceId=${encodeURIComponent(conn.workspaceId)}&comments=1${conn.commentSettings?.mentions ? '&mentions=1' : ''}`
  const grouped = workspaces
    .map((w) => ({ workspace: w, items: connections.filter((c) => c.workspaceId === w.id) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canales</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Conecta páginas de Facebook (Messenger) y cuentas de Instagram para responder desde la{' '}
            <Link href="/admin/inbox" className="text-primary-600 font-medium hover:underline">bandeja de entrada</Link>.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* ── Meta App config ── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <KeyRound size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">App de Meta</h2>
              <p className="text-xs text-gray-500">
                Claves de la app (la misma que usas para WhatsApp). Se guardan cifradas en la base de datos.
                {!canEditApp && ' Solo un superadmin puede editarlas.'}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${configured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {configured ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {configured ? 'Configurada' : 'Pendiente'}
          </span>
        </div>

        <fieldset disabled={!canEditApp} className="grid grid-cols-1 md:grid-cols-2 gap-4 disabled:opacity-60">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">App ID</span>
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.appId}
              onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
              placeholder="1234567890"
              inputMode="numeric"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">App Secret</span>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.appSecret}
                onChange={(e) => setForm((f) => ({ ...f, appSecret: e.target.value }))}
                placeholder={metaApp?.hasAppSecret ? `Guardado (${metaApp.appSecret}) — deja vacío para conservarlo` : 'Pega el App Secret'}
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Verify token (webhook)</span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.verifyToken}
                onChange={(e) => setForm((f) => ({ ...f, verifyToken: e.target.value }))}
                placeholder="Cadena secreta que pegas en la consola de Meta"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, verifyToken: randomToken() }))}
                className="shrink-0 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Generar
              </button>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Versión Graph API</span>
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.graphVersion}
                onChange={(e) => setForm((f) => ({ ...f, graphVersion: e.target.value }))}
                placeholder="v26.0"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Config ID <span className="text-gray-400">(opcional)</span></span>
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.configId}
                onChange={(e) => setForm((f) => ({ ...f, configId: e.target.value }))}
                placeholder="Solo Embedded Signup"
              />
            </label>
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">
            Productos requeridos en la app: <strong>Facebook Login for Business</strong> y <strong>Webhooks</strong> (objetos <code>page</code> e <code>instagram</code>). La app debe estar <strong>publicada</strong> para recibir mensajes de terceros.
          </p>
          <button
            onClick={saveMetaApp}
            disabled={!canEditApp || saving || !form.appId || !form.verifyToken || (!form.appSecret && !metaApp?.hasAppSecret)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 transition"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar
          </button>
        </div>

        {urls && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <CopyField label="Redirect URI (OAuth)" value={urls.redirect} />
            <CopyField label="Webhook Messenger (objeto page)" value={urls.messenger} />
            <CopyField label="Webhook Instagram (objeto instagram)" value={urls.instagram} />
          </div>
        )}
      </section>

      {/* ── Connected accounts ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900">Cuentas conectadas</h2>
            <p className="text-xs text-gray-500">Autorizar → elegir cuentas → confirmado. Cada cuenta enruta sus mensajes a la bandeja por su ID.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              value={selectedWs}
              onChange={(e) => setSelectedWs(e.target.value)}
              disabled={manageableWs.length === 0}
              title="Workspace donde se conectará la cuenta"
            >
              {manageableWs.length === 0 && <option value="">Sin workspace propio</option>}
              {manageableWs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600" title="Pide también los permisos para leer, responder y moderar comentarios">
              <input type="checkbox" checked={withComments} onChange={(e) => setWithComments(e.target.checked)} /> Con comentarios
            </label>
            {withComments && (
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600" title="Solo Instagram: menciones a la cuenta en publicaciones de otros">
                <input type="checkbox" checked={withMentions} onChange={(e) => setWithMentions(e.target.checked)} /> y menciones (IG)
              </label>
            )}
            <a
              href={canConnect ? connectHref('messenger') : undefined}
              aria-disabled={!canConnect}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${canConnect ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-gray-100 text-gray-400 pointer-events-none'}`}
            >
              <Facebook size={16} /> Conectar Messenger
            </a>
            <a
              href={canConnect ? connectHref('instagram') : undefined}
              aria-disabled={!canConnect}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${canConnect ? 'bg-pink-600 text-white hover:bg-pink-700' : 'bg-gray-100 text-gray-400 pointer-events-none'}`}
            >
              <Instagram size={16} /> Conectar Instagram
            </a>
          </div>
        </div>

        {!configured && !loading && (
          <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 p-4">
            Guarda primero las claves de la App de Meta para habilitar la conexión de cuentas.
          </p>
        )}
        {configured && !loading && manageableWs.length === 0 && (
          <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 p-4">
            Para conectar cuentas necesitas ser propietario de un workspace.{' '}
            <Link href="/admin/workspaces" className="text-primary-600 font-medium hover:underline">Crea uno</Link> o pide a un propietario que te promueva.
          </p>
        )}

        {loading && connections.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-3" />
            <span className="text-sm">Cargando…</span>
          </div>
        ) : connections.length === 0 ? (
          configured && (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
              <Link2 size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aún no hay páginas ni cuentas conectadas.</p>
            </div>
          )
        ) : (
          grouped.map(({ workspace, items }) => (
          <div key={workspace.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{workspace.name}</span>
              <span className="text-[11px] text-gray-400">· {items.length} cuenta{items.length === 1 ? '' : 's'}</span>
              {!workspace.canManage && <span className="text-[11px] text-gray-400">· solo lectura</span>}
            </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((conn) => {
              const caps = conn.capabilities
              const busy = busyId === conn.id
              return (
                <div key={conn.id} className={`rounded-2xl border bg-white p-4 sm:p-5 flex flex-col gap-3 ${conn.enabled ? 'border-gray-200' : 'border-gray-200 opacity-70'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${conn.channel === 'INSTAGRAM' ? 'bg-pink-50' : 'bg-sky-50'}`}>
                      <ChannelIcon channel={conn.channel} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{conn.name}</p>
                        <span className="text-[11px] text-gray-400">{CHANNEL_LABEL[conn.channel]}</span>
                        {!conn.enabled && <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-[10px] font-semibold">Pausada</span>}
                        {conn.status === 'ERROR' && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold">Error</span>}
                      </div>
                      <p className="text-xs text-gray-500 font-mono truncate">
                        ID {conn.externalId}{conn.meta?.pageId && conn.meta.pageId !== conn.externalId ? ` · página ${conn.meta.pageId}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <CapChip ok={caps ? caps.receive : null} label="Recibir" detail={caps?.receiveDetail} />
                    <CapChip ok={caps ? caps.send : null} label="Enviar" detail={caps?.sendDetail} />
                    {conn.meta?.subscribedFields && conn.meta.subscribedFields.length > 0 && (
                      <span className="text-[11px] text-gray-400" title={conn.meta.subscribedFields.join(', ')}>
                        {conn.meta.subscribedFields.length} campos suscritos
                      </span>
                    )}
                    {caps?.checkedAt && <span className="text-[11px] text-gray-400">· verificado {timeAgo(caps.checkedAt)}</span>}
                  </div>

                  {conn.lastError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 break-words">{conn.lastError}</p>
                  )}
                  <CommentsBox conn={conn} busy={busy} onPatch={(patch) => patchComments(conn, patch)} reconnectHref={reconnectHref(conn)} />
                  {caps && !caps.send && caps.sendDetail && !conn.lastError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 break-words">Envío: {caps.sendDetail}</p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-xs text-gray-500 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Inbox size={12} /> {conn._count?.conversations ?? 0} conversaciones</span>
                    <span>{conn.lastEventAt ? `Último evento ${timeAgo(conn.lastEventAt)}` : 'Sin eventos aún'}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 flex-wrap">
                    <button onClick={() => diagnose(conn)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Stethoscope size={13} />} Diagnosticar
                    </button>
                    {conn.canManage && (
                      <>
                        <button onClick={() => toggleEnabled(conn)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                          {conn.enabled ? <Pause size={13} /> : <Play size={13} />} {conn.enabled ? 'Pausar' : 'Reanudar'}
                        </button>
                        <button onClick={() => disconnect(conn)} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 size={13} /> Desconectar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </div>
          ))
        )}

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600 flex items-center gap-1.5"><ShieldCheck size={13} /> Recordatorios de Meta</p>
          <p>• <strong>Instagram</strong>: la suscripción al objeto <code>instagram</code> se configura en la consola de Meta (Webhooks), no por API: marca <code>messages, messaging_postbacks, messaging_referral, message_reactions, messaging_seen</code>.</p>
          <p>• Las <strong>solicitudes de mensaje</strong> (carpeta pendientes) no generan webhook; se revisan cada 2 minutos automáticamente.</p>
          <p>• Fuera de la ventana de 24 h solo puede escribir una persona (etiqueta <code>HUMAN_AGENT</code>, hasta 7 días, requiere permiso en App Review).</p>
        </div>
      </section>

      {/* ── Webhook events ── */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900">Eventos recientes de webhook</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">Sin eventos registrados.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Cuándo</th>
                    <th className="text-left px-3 py-2 font-medium">Canal</th>
                    <th className="text-left px-3 py-2 font-medium">Cuenta</th>
                    <th className="text-left px-3 py-2 font-medium">Estado</th>
                    <th className="text-left px-3 py-2 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{timeAgo(ev.createdAt)}</td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><ChannelIcon channel={ev.channel} size={13} /> {CHANNEL_LABEL[ev.channel]}</span></td>
                      <td className="px-3 py-2 font-mono text-gray-600">{ev.externalId || '—'}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 font-semibold ${EVENT_STATUS_STYLE[ev.status]}`}>{ev.status}</span></td>
                      <td className="px-3 py-2 text-gray-600 max-w-[380px] truncate" title={ev.detail || ''}>{ev.detail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Selection modal (step 2 of OAuth) ── */}
      {sessionId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2 min-w-0">
                {sessionChannel && <ChannelIcon channel={sessionChannel} />}
                <h3 className="font-semibold text-gray-900 truncate">
                  Elige qué conectar
                  {sessionWorkspaceName && <span className="text-gray-400 font-normal"> · {sessionWorkspaceName}</span>}
                </h3>
              </div>
              <button onClick={() => { setSessionId(null); setCandidates(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {candidates === null ? (
                <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 size={22} className="animate-spin mr-2" /> Leyendo tus páginas…</div>
              ) : sessionError ? (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {sessionError}</div>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Meta no devolvió {sessionChannel === 'INSTAGRAM' ? 'cuentas de Instagram vinculadas a tus páginas' : 'páginas'} con esta autorización.
                  {sessionChannel === 'INSTAGRAM' && ' Vincula la cuenta profesional de Instagram a una página de Facebook y vuelve a intentarlo.'}
                </p>
              ) : (
                candidates.map((c) => {
                  const checked = selected.has(c.id)
                  const blocked = Boolean(c.takenByWorkspace)
                  return (
                    <label key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 transition ${blocked ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : checked ? 'border-primary-400 bg-primary-50 cursor-pointer' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary-600"
                        checked={checked}
                        disabled={blocked}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(c.id); else next.delete(c.id)
                            return next
                          })
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">ID {c.id}{c.pageId !== c.id ? ` · página ${c.pageId}` : ''}</p>
                      </div>
                      {c.alreadyConnected && (
                        <span className="shrink-0 rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-semibold">Ya conectada · renovará token</span>
                      )}
                      {c.takenByWorkspace && (
                        <span className="shrink-0 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-semibold">Ocupada por "{c.takenByWorkspace}"</span>
                      )}
                    </label>
                  )
                })
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t">
              <span className="text-xs text-gray-500">{selected.size} seleccionada(s)</span>
              <div className="flex gap-2">
                <button onClick={() => { setSessionId(null); setCandidates(null) }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={completeSelection}
                  disabled={connecting || selected.size === 0 || !!sessionError}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
                >
                  {connecting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Conectar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Los tokens de página se almacenan cifrados (AES-256-GCM). Consola de Meta:{' '}
        <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary-600 hover:underline">developers.facebook.com <ExternalLink size={10} /></a>
      </p>
    </div>
  )
}
