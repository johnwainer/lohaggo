'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart3, CalendarDays, FileText, Loader2, Megaphone, Palette, ShieldCheck } from 'lucide-react'
import { api, type Account } from '@/components/admin/marketing/shared'
import PostsTab, { type PostRow } from '@/components/admin/marketing/PostsTab'
import CalendarTab from '@/components/admin/marketing/CalendarTab'
import CampaignsTab, { type Campaign } from '@/components/admin/marketing/CampaignsTab'
import StatsTab from '@/components/admin/marketing/StatsTab'
import PermissionsTab from '@/components/admin/marketing/PermissionsTab'
import BrandTab from '@/components/admin/marketing/BrandTab'

type Workspace = { id: string; name: string; permissions: string[]; canManagePermissions: boolean }
type Overview = { workspaces: Workspace[]; posts: PostRow[]; campaigns: Campaign[]; accounts: Account[] }

const TABS = [
  ['posts', 'Publicaciones', FileText],
  ['calendar', 'Parrilla', CalendarDays],
  ['campaigns', 'Campañas', Megaphone],
  ['stats', 'Estadísticas', BarChart3],
  ['brand', 'Marca e imágenes', Palette],
  ['permissions', 'Permisos', ShieldCheck],
] as const
type Tab = (typeof TABS)[number][0]

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('posts')
  const [workspaceId, setWorkspaceId] = useState('')
  const [data, setData] = useState<Overview | null>(null)
  const [filters, setFilters] = useState<{ status: string; campaignId: string; channel: string; q: string }>({ status: '', campaignId: '', channel: '', q: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const t = localStorage.getItem('mk.tab') as Tab | null
      if (t && TABS.some(([k]) => k === t)) setTab(t)
      setWorkspaceId(localStorage.getItem('mk.ws') || '')
    } catch {
      // storage unavailable
    }
  }, [])
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
  const visibleTabs = TABS.filter(([k]) => k !== 'permissions' || ws.some((w) => w.canManagePermissions))

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publicaciones y campañas</h1>
          <p className="text-sm text-gray-500 mt-1">Crea una vez y publica en el blog, Facebook e Instagram; programa, agrupa en campañas y mide.</p>
        </div>
        {ws.length > 1 && (
          <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); try { localStorage.setItem('mk.ws', e.target.value) } catch { /* noop */ } }}>
            <option value="">Todos los workspaces</option>
            {ws.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      {problems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {problems.length === 1 ? 'Una cuenta no puede publicar' : `${problems.length} cuentas no pueden publicar`}</p>
          {problems.map((a) => <p key={a.id} className="text-xs">{a.name}: {a.problem}</p>)}
          <Link href="/admin/channels" className="inline-block text-xs font-semibold underline">Ir a Canales para reconectar</Link>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {visibleTabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === key ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

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
          {tab === 'campaigns' && <CampaignsTab campaigns={data.campaigns} workspace={activeWs} canEdit={can('edit')} onChanged={load} />}
          {tab === 'stats' && <StatsTab workspaceId={workspaceId} campaigns={data.campaigns} />}
          {tab === 'brand' && <BrandTab workspaces={activeWs ? [activeWs] : ws} />}
          {tab === 'permissions' && <PermissionsTab workspaces={ws.filter((w) => w.canManagePermissions)} />}
        </>
      )}
    </div>
  )
}
