'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Bot, CalendarDays, ChevronDown, FileText, Loader2, Megaphone, Palette, Settings, ShieldCheck, SpellCheck } from 'lucide-react'
import { api, type Account } from '@/components/admin/marketing/shared'
import PostsTab, { type PostRow } from '@/components/admin/marketing/PostsTab'
import CalendarTab from '@/components/admin/marketing/CalendarTab'
import CampaignsTab, { type Campaign } from '@/components/admin/marketing/CampaignsTab'
import StatsTab from '@/components/admin/marketing/StatsTab'
import PermissionsTab from '@/components/admin/marketing/PermissionsTab'
import BrandTab from '@/components/admin/marketing/BrandTab'
import EditorialTab from '@/components/admin/marketing/EditorialTab'
import AgentTab from '@/components/admin/marketing/agent/AgentTab'
import NoticesBell from '@/components/admin/marketing/agent/NoticesBell'

type Workspace = { id: string; name: string; permissions: string[]; canManagePermissions: boolean }
type Overview = { workspaces: Workspace[]; posts: PostRow[]; campaigns: Campaign[]; accounts: Account[] }

type Tab = 'posts' | 'calendar' | 'campaigns' | 'agent' | 'stats' | 'editorial' | 'brand' | 'permissions'
type TabDef = { key: Tab; label: string; icon: typeof FileText; help: string }

/** Sections grouped by what the person is doing: create, plan, measure; settings apart. */
const GROUPS: Array<{ label: string; tabs: TabDef[] }> = [
  {
    label: 'Crear',
    tabs: [
      { key: 'posts', label: 'Publicaciones', icon: FileText, help: 'Todo lo que se escribe: borradores, en revisión, programado y publicado. Crea una vez y adáptala al blog, Facebook e Instagram.' },
      { key: 'calendar', label: 'Calendario', icon: CalendarDays, help: 'Qué sale y cuándo. Arrastra una publicación a otro día para moverla; las tarjetas punteadas son ideas del agente.' },
    ],
  },
  {
    label: 'Planificar',
    tabs: [
      { key: 'campaigns', label: 'Campañas', icon: Megaphone, help: 'Agrupa publicaciones con un mismo objetivo para planificarlas juntas y medir sus resultados en conjunto.' },
      { key: 'agent', label: 'Agente IA', icon: Bot, help: 'Un estratega con IA por campaña: propone ideas, redacta, elige imagen y horario, y publica según la autonomía que le des.' },
    ],
  },
  {
    label: 'Medir',
    tabs: [
      { key: 'stats', label: 'Resultados', icon: BarChart3, help: 'Alcance, interacción, visitas al blog y conversaciones en la bandeja, por canal, publicación y campaña.' },
    ],
  },
]
/** Rarely used: in a menu next to the bell instead of the main bar. */
const SETTINGS: { label: string; tabs: TabDef[] } = {
    label: 'Ajustes',
    tabs: [
      { key: 'editorial', label: 'Revisión editorial', icon: SpellCheck, help: 'Un corrector de ortografía y un editor experto revisan cada pieza antes de que salga.' },
      { key: 'brand', label: 'Marca e imágenes', icon: Palette, help: 'El logo que se pone en las imágenes y de dónde salen las fotos (Pexels o IA).' },
      { key: 'permissions', label: 'Permisos', icon: ShieldCheck, help: 'Quién puede ver, editar y publicar en cada workspace.' },
    ],
}
const TABS = [...GROUPS.flatMap((g) => g.tabs), ...SETTINGS.tabs]

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('posts')
  const [workspaceId, setWorkspaceId] = useState('')
  const [data, setData] = useState<Overview | null>(null)
  const [filters, setFilters] = useState<{ status: string; campaignId: string; channel: string; q: string }>({ status: '', campaignId: '', channel: '', q: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [agentTarget, setAgentTarget] = useState<{ id?: string; wizard?: boolean } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    try {
      const t = localStorage.getItem('mk.tab') as Tab | null
      if (t && TABS.some((x) => x.key === t)) setTab(t)
      setWorkspaceId(localStorage.getItem('mk.ws') || '')
    } catch {
      // storage unavailable
    }
    // Links from the agent's notices and emails: /admin/marketing?agente=<id>
    const agent = new URLSearchParams(window.location.search).get('agente')
    if (agent) {
      setTab('agent')
      setAgentTarget({ id: agent })
    }
  }, [])
  const openAgent = (id: string) => { setTab('agent'); setAgentTarget({ id }) }
  useEffect(() => { try { localStorage.setItem('mk.tab', tab) } catch { /* noop */ } }, [tab])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (workspaceId) q.set('workspaceId', workspaceId)
      for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v)
      const d = await api<Overview>(`/api/admin/marketing?${q}`)
      setData(d)
      setError(null)
      if (workspaceId && !d.workspaces.some((w) => w.id === workspaceId)) setWorkspaceId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, filters])

  useEffect(() => { load() }, [load])

  const ws = data?.workspaces || []
  // Actions act on one workspace: the selected one, or the only one the person has
  const activeWs = ws.find((w) => w.id === workspaceId) || (ws.length === 1 ? ws[0] : null)
  const can = (p: string) => Boolean(activeWs?.permissions.includes(`marketing.${p}`))
  const problems = (data?.accounts || []).filter((a) => a.problem)
  const showTab = (k: Tab) => k !== 'permissions' || ws.some((w) => w.canManagePermissions)
  const current = TABS.find((x) => x.key === tab)
  // Pieces waiting for someone to approve them: shown on "Publicaciones"
  const inReview = (data?.posts || []).filter((p) => p.status === 'review').length

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicaciones y campañas</h1>
          <p className="text-sm text-gray-500 mt-1">Blog, Facebook e Instagram en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
        {ws.length > 0 && <NoticesBell workspaceId={workspaceId} onOpenAgent={openAgent} />}
        {ws.length > 0 && (
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setSettingsOpen((o) => !o)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm ${SETTINGS.tabs.some((t) => t.key === tab) ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Settings size={16} /> <span className="hidden sm:inline">Ajustes</span> <ChevronDown size={14} />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-xl">
                {SETTINGS.tabs.filter((t) => showTab(t.key)).map(({ key, label, icon: Icon, help }) => (
                  <button key={key} onClick={() => { setTab(key); setSettingsOpen(false) }} className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 ${tab === key ? 'bg-primary-50' : ''}`}>
                    <Icon size={16} className="mt-0.5 shrink-0 text-gray-500" />
                    <span><span className="block text-sm font-medium text-gray-900">{label}</span><span className="block text-xs text-gray-500">{help}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {ws.length > 1 && (
          <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); try { localStorage.setItem('mk.ws', e.target.value) } catch { /* noop */ } }}>
            <option value="">Todos los workspaces</option>
            {ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        </div>
      </div>

      {problems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {problems.length === 1 ? 'Una cuenta no puede publicar' : `${problems.length} cuentas no pueden publicar`}</p>
          {problems.map((a) => <p key={a.id} className="text-xs">{a.name}: {a.problem}</p>)}
          <Link href="/admin/channels" className="inline-block text-xs font-semibold underline">Ir a Canales para reconectar</Link>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <nav className="space-y-2" aria-label="Secciones">
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GROUPS.map((g) => {
            const tabs = g.tabs.filter((t) => showTab(t.key))
            if (!tabs.length) return null
            return (
              <div key={g.label} className="flex shrink-0 items-center gap-1">
                <span className="hidden px-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 md:inline">{g.label}</span>
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    aria-current={tab === key ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${tab === key ? 'bg-primary-600 font-semibold text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <Icon size={15} /> {label}
                    {key === 'posts' && inReview > 0 && <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === key ? 'bg-white text-primary-700' : 'bg-amber-500 text-white'}`} title="En revisión">{inReview}</span>}
                  </button>
                ))}
                {g !== GROUPS[GROUPS.length - 1] && <span className="ml-1 hidden h-6 w-px bg-gray-200 sm:block" />}
              </div>
            )
          })}
        </div>
        {current && <p className="px-1 text-sm text-gray-500">{current.help}</p>}
      </nav>

      {!data ? (
        <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">{loading ? <><Loader2 className="animate-spin" size={18} /> Cargando…</> : null}</div>
      ) : ws.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-500">No tienes acceso al módulo de publicaciones en ningún workspace. Pídele al propietario que te dé permiso.</div>
      ) : (
        <>
          {tab === 'posts' && (
            <PostsTab
              posts={data.posts} campaigns={data.campaigns} filters={filters} setFilters={setFilters}
              workspace={activeWs} workspaces={ws} canCreate={can('edit')} loading={loading} onChanged={load}
            />
          )}
          {tab === 'calendar' && <CalendarTab workspaceId={workspaceId} campaigns={data.campaigns} workspace={activeWs} canEdit={can('edit')} />}
          {tab === 'campaigns' && <CampaignsTab campaigns={data.campaigns} workspace={activeWs} canEdit={can('edit')} onChanged={load} onCreateWithAgent={() => { setTab('agent'); setAgentTarget({ wizard: true }) }} />}
          {tab === 'agent' && <AgentTab workspaceId={workspaceId} workspace={activeWs} openAgentId={agentTarget?.id} openWizard={agentTarget?.wizard} onOpened={() => setAgentTarget(null)} />}
          {tab === 'stats' && <StatsTab workspaceId={workspaceId} campaigns={data.campaigns} />}
          {tab === 'editorial' && <EditorialTab key={activeWs?.id ?? 'all'} workspaces={activeWs ? [activeWs] : ws} />}
          {tab === 'brand' && <BrandTab workspaces={activeWs ? [activeWs] : ws} />}
          {tab === 'permissions' && <PermissionsTab workspaces={ws.filter((w) => w.canManagePermissions)} />}
        </>
      )}
    </div>
  )
}
