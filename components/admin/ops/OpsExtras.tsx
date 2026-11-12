'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, Copy, Loader2, MessageCircle } from 'lucide-react'
import { DATA_REQUEST_LABEL, dueCountdown, type DataRequestKind } from '@/lib/privacy/data-requests-core'
import { FRAUD_LABEL } from '@/lib/fraud/core'
import { recruitText, type CoverageRow, type GapKind } from '@/lib/admin/coverage-matrix'

const card = 'rounded-xl border border-gray-100 bg-white shadow-sm'
const btn = 'min-h-9 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60'

/** A collapsed section that loads its data the first time it opens. */
function Section({ title, hint, badge, onOpen, children }: { title: string; hint: string; badge?: ReactNode; onOpen: () => void; children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  return (
    <details className={`${card} group`} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && !opened) { setOpened(true); onOpen() } }}>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{badge}<ChevronDown size={18} className="text-gray-400 transition-transform group-open:rotate-180" /></div>
      </summary>
      <div className="space-y-2 border-t border-gray-100 p-4 sm:p-5">{children}</div>
    </details>
  )
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 403 ? 'Solo el superadmin' : `El servidor respondió ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [url])
  return { data, loading, error, load }
}

const Status = ({ loading, error }: { loading: boolean; error: string | null }) => (
  <>
    {loading && <p className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Cargando…</p>}
    {error && <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><AlertTriangle size={14} /> {error}</p>}
  </>
)

// ─── Datos personales ───────────────────────────────────────────────────────

type DataReq = { id: string; email: string; name: string | null; type: DataRequestKind; status: string; message: string | null; dueAt: string; notes: string | null; userId: string | null; user: { name: string; role: string; isActive: boolean } | null }

function DataRequests() {
  const { data, loading, error, load } = useLoad<{ requests: DataReq[]; canAnonymize: boolean }>('/api/admin/data-requests')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const open = (data?.requests ?? []).filter((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS')

  const patch = async (id: string, status: string) => {
    setBusy(id); setActionError(null)
    try {
      const res = await fetch('/api/admin/data-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Error ${res.status}`)
      await load()
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Error') } finally { setBusy(null) }
  }
  const anonymize = async (r: DataReq) => {
    if (!window.confirm(`Esto desactiva y borra los datos personales de ${r.user?.name ?? r.email}. No se puede deshacer. ¿Seguro? Verifica antes la identidad de quien lo pidió.`)) return
    setBusy(r.id); setActionError(null)
    try {
      const res = await fetch(`/api/admin/data-requests/${r.id}/anonymize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Error ${res.status}`)
      await load()
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Error') } finally { setBusy(null) }
  }

  const tone = { overdue: 'bg-rose-100 text-rose-800', soon: 'bg-amber-100 text-amber-800', ok: 'bg-green-100 text-green-800' }
  return (
    <Section title="Datos personales (Ley 1581)" hint="Solicitudes de acceso, corrección y eliminación: 15 días hábiles" onOpen={load} badge={data ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">{open.length}</span> : null}>
      <Status loading={loading && !data} error={error} />
      {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
      {data && open.length === 0 && <p className="text-sm text-gray-400">Sin solicitudes pendientes.</p>}
      {open.map((r) => {
        const c = dueCountdown(r.dueAt)
        return (
          <div key={r.id} className="space-y-2 rounded-xl border border-gray-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-semibold text-gray-900">{DATA_REQUEST_LABEL[r.type]}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone[c.tone]}`}>{c.label}</span>
            </div>
            <p className="break-all text-xs text-gray-600">{r.name ? `${r.name} · ` : ''}{r.email}{r.user ? ` · cuenta ${r.user.role === 'PARTNER' ? 'de socio' : 'de cliente'}${r.user.isActive ? '' : ' (inactiva)'}` : ' · sin cuenta con ese correo'}</p>
            {r.message && <p className="break-words rounded-lg bg-gray-50 p-2 text-xs text-gray-700">{r.message}</p>}
            <div className="flex flex-wrap gap-2">
              {r.status === 'OPEN' && <button className={btn} disabled={busy === r.id} onClick={() => patch(r.id, 'IN_PROGRESS')}>En curso</button>}
              <button className={`${btn} !border-green-600 !bg-green-600 !text-white hover:!bg-green-700`} disabled={busy === r.id} onClick={() => patch(r.id, 'RESOLVED')}>Resuelta</button>
              <button className={btn} disabled={busy === r.id} onClick={() => patch(r.id, 'REJECTED')}>Rechazar</button>
              {data?.canAnonymize && r.type === 'DELETE' && r.userId && (
                <button className={`${btn} !border-rose-300 !text-rose-700`} disabled={busy === r.id} onClick={() => anonymize(r)}>Anonimizar cuenta</button>
              )}
            </div>
          </div>
        )
      })}
    </Section>
  )
}

// ─── Señales de fraude ──────────────────────────────────────────────────────

type Signal = { id: string; type: string; severity: string; score: number; reason: string; createdAt: string; user: { id: string; name: string } | null; partner: { user: { name: string } } | null }

function FraudSignals() {
  const { data, loading, error, load } = useLoad<{ signals: Signal[] }>('/api/admin/fraud-signals')
  const [busy, setBusy] = useState<string | null>(null)
  const patch = async (id: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    setBusy(id)
    try { await fetch('/api/admin/fraud-signals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }); await load() } finally { setBusy(null) }
  }
  const sev: Record<string, string> = { LOW: 'bg-gray-100 text-gray-700', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-rose-100 text-rose-800', CRITICAL: 'bg-rose-600 text-white' }
  return (
    <Section title="Señales de fraude" hint="Intentos de sacar el servicio de la plataforma, parejas sospechosas, celulares repetidos" onOpen={load} badge={data ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">{data.signals.length}</span> : null}>
      <Status loading={loading && !data} error={error} />
      {data && data.signals.length === 0 && <p className="text-sm text-gray-400">Sin señales abiertas.</p>}
      {data?.signals.map((s) => (
        <div key={s.id} className="space-y-2 rounded-xl border border-gray-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-gray-900">{FRAUD_LABEL[s.type] ?? s.type}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sev[s.severity] ?? sev.LOW}`}>{s.severity} · {s.score}</span>
          </div>
          <p className="break-words text-xs text-gray-600">{s.reason}</p>
          <p className="break-words text-xs text-gray-500">{s.user?.name ?? '—'}{s.partner ? ` ↔ ${s.partner.user.name}` : ''} · {new Date(s.createdAt).toLocaleDateString('es-CO')}</p>
          <div className="flex gap-2">
            <button className={btn} disabled={busy === s.id} onClick={() => patch(s.id, 'ACKNOWLEDGED')}>Revisada</button>
            <button className={`${btn} !border-green-600 !bg-green-600 !text-white hover:!bg-green-700`} disabled={busy === s.id} onClick={() => patch(s.id, 'RESOLVED')}>Cerrar</button>
          </div>
        </div>
      ))}
    </Section>
  )
}

// ─── Cobertura ──────────────────────────────────────────────────────────────

type CoverageData = { rows: Array<Omit<CoverageRow, 'zones'> & { zones: Array<CoverageRow['zones'][number] & { label: string }> }>; missing: Array<{ term: string; searches: number; variants: string[] }> }
const GAP_LABEL: Record<GapKind, { text: string; cls: string }> = {
  no_supply: { text: 'Demanda sin oferta', cls: 'bg-rose-100 text-rose-800' },
  low_response: { text: 'Pocas propuestas', cls: 'bg-amber-100 text-amber-800' },
  no_demand: { text: 'Oferta sin demanda', cls: 'bg-blue-100 text-blue-800' },
  balanced: { text: 'Equilibrado', cls: 'bg-green-100 text-green-800' },
}

function Coverage() {
  const { data, loading, error, load } = useLoad<CoverageData>('/api/admin/coverage')
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const rows = (data?.rows ?? []).filter((r) => showAll || r.gap !== 'balanced')
  const recruit = (r: { serviceName: string; city: string }) => recruitText(r.serviceName, r.city)
  const copy = async (key: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800) } catch { /* sin portapapeles */ } }

  return (
    <Section title="Cobertura" hint="Demanda vs oferta por servicio, ciudad y zona (30 y 90 días)" onOpen={load} badge={data ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">{data.rows.filter((r) => r.gap !== 'balanced').length} brechas</span> : null}>
      <Status loading={loading && !data} error={error} />
      {data && (
        <>
          <label className="flex min-h-9 items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4" /> Mostrar también los equilibrados</label>
          {rows.length === 0 && <p className="text-sm text-gray-400">Sin brechas en los últimos 90 días.</p>}
          {rows.map((r) => {
            const key = `${r.serviceId}|${r.city}`
            const gap = GAP_LABEL[r.gap]
            return (
              <div key={key} className="space-y-2 rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-gray-900">{r.serviceName} <span className="font-normal text-gray-500">· {r.city.charAt(0) + r.city.slice(1).toLowerCase()}</span></p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${gap.cls}`}>{gap.text}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['30 d', r.requests30], ['90 d', r.requests90], ['Con prop.', r.proposalPct30 === null ? '—' : `${r.proposalPct30}%`], ['Socios', r.partners]].map(([k, v]) => (
                    <div key={String(k)} className="rounded-lg bg-gray-50 p-2"><p className="text-[10px] font-semibold uppercase text-gray-500">{k}</p><p className="text-base font-black text-gray-900">{v}</p></div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Vencidas: {r.expired30} (30 d) · {r.expired90} (90 d)</p>
                {r.zones.length > 0 && <p className="break-words text-xs text-gray-600">Zonas: {r.zones.slice(0, 5).map((z) => `${z.label} ${z.requests90} sol. / ${z.partners} socios`).join(' · ')}</p>}
                {(r.gap === 'no_supply' || r.gap === 'low_response') && (
                  <div className="flex flex-wrap gap-2">
                    <a className={`${btn} inline-flex items-center gap-1.5 !border-[#128C4A] !bg-[#128C4A] !text-white`} href={`https://wa.me/?text=${encodeURIComponent(recruit(r))}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> Reclutar</a>
                    <button className={`${btn} inline-flex items-center gap-1.5`} onClick={() => copy(key, recruit(r))}><Copy size={13} /> {copied === key ? 'Copiado' : 'Copiar texto'}</button>
                  </div>
                )}
              </div>
            )
          })}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-gray-900">Servicios que faltan en el catálogo</h3>
            <p className="text-xs text-gray-500">Búsquedas de los últimos 90 días sin resultado que el catálogo y los sinónimos todavía no entienden.</p>
            {data.missing.length === 0 && <p className="text-sm text-gray-400">Nada por ahora.</p>}
            {data.missing.map((m) => (
              <div key={m.term} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <p className="min-w-0 break-words text-sm text-gray-900">{m.term}{m.variants.length > 1 ? <span className="text-xs text-gray-500"> · {m.variants.slice(0, 3).join(' / ')}</span> : null}</p>
                <span className="shrink-0 text-xs font-bold text-gray-700">{m.searches} búsq.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  )
}

// ─── Duplicados y limpieza (superadmin) ─────────────────────────────────────

type DupGroup = { reason: 'phone' | 'name'; key: string; accounts: Array<{ id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; createdAt: string; viaChat: boolean }> }

function Duplicates() {
  const { data, loading, error, load } = useLoad<{ groups: DupGroup[]; total: number }>('/api/admin/accounts/duplicates')
  return (
    <Section title="Cuentas duplicadas (superadmin)" hint="Mismo celular, o mismo nombre creado en 1 h por chat. Solo lectura, para unir a mano" onOpen={load} badge={data ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">{data.total}</span> : null}>
      <Status loading={loading && !data} error={error} />
      {data && data.groups.length === 0 && <p className="text-sm text-gray-400">Sin duplicados probables.</p>}
      {data?.groups.map((g, i) => (
        <div key={`${g.key}-${i}`} className="space-y-1.5 rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-bold uppercase text-gray-500">{g.reason === 'phone' ? `Mismo celular ${g.key}` : `Mismo nombre: ${g.key}`}</p>
          {g.accounts.map((a) => (
            <a key={a.id} href={`/admin/users/${a.id}`} className="block break-words rounded-lg bg-gray-50 p-2 text-xs text-gray-700 hover:bg-gray-100">
              <span className="font-semibold text-gray-900">{a.name}</span> · {a.role === 'PARTNER' ? 'socio' : 'cliente'}{a.isActive ? '' : ' · inactiva'}{a.viaChat ? ' · por chat' : ''}<br />{a.email} · {a.phone ?? 'sin celular'} · {new Date(a.createdAt).toLocaleString('es-CO')}
            </a>
          ))}
        </div>
      ))}
    </Section>
  )
}

function PwaCleanup() {
  const [state, setState] = useState<string | null>(null)
  const run = async () => {
    if (!window.confirm('¿Cerrar todos los incidentes abiertos de adopción de la app? El detector abre uno nuevo por condición si todavía aplica.')) return
    const res = await fetch('/api/admin/pwa-adoption/cleanup-incidents', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setState(res.ok ? `${d.resolved} incidentes cerrados` : d.error || `Error ${res.status}`)
  }
  return (
    <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5`}>
      <div className="min-w-0"><h2 className="text-base font-bold text-gray-900">Limpiar alertas de adopción de la app</h2><p className="text-xs text-gray-500">Superadmin: cierra los incidentes repetidos de «pwa-adoption-alerts».</p></div>
      <div className="flex items-center gap-2"><button className={btn} onClick={run}>Cerrar incidentes</button>{state && <span role="status" className="text-xs text-gray-600">{state}</span>}</div>
    </div>
  )
}

export default function OpsExtras() {
  return (
    <div className="space-y-3">
      <DataRequests />
      <FraudSignals />
      <Coverage />
      <Duplicates />
      <PwaCleanup />
    </div>
  )
}
