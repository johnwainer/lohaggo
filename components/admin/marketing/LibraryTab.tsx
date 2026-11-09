'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Download, ExternalLink, Film, Loader2, Repeat2, Search, Sparkles, Trophy, X } from 'lucide-react'
import { FormatPill, MkChannelIcon, StatusChip, api, fmtDate, input, num } from '@/components/admin/marketing/shared'
import { useDialog } from '@/components/ui/use-dialog'
import {
  FORMAT_FIT_LABEL,
  ORIENTATION_LABEL,
  ORIGIN_LABEL,
  downloadUrl,
  filterLibrary,
  type LibraryAsset,
  type LibraryFilters,
  type PieceRow,
} from '@/lib/marketing/library-core'
import type { Orientation } from '@/lib/marketing/images-core'

type Ws = { id: string; name: string; permissions: string[] }
type Target = { id: string; title: string; status: string; updatedAt: string }
type LibraryData = { assets: LibraryAsset[]; facets: { services: string[]; origins: string[] }; targets: Target[]; canEdit: boolean }

const originLabel = (o: string) => ORIGIN_LABEL[o] ?? o

export function AssetBadges({ a }: { a: LibraryAsset }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.origin === 'ai' ? 'bg-violet-100 text-violet-800' : 'bg-gray-100 text-gray-700'}`}>{a.origin === 'ai' && <Sparkles size={9} className="mr-0.5 inline" />}{originLabel(a.origin)}</span>
      {a.uses ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">Usada {a.uses}×</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Sin usar</span>}
      {a.formats.map((f) => <span key={f} className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-gray-600 ring-1 ring-inset ring-gray-200">{FORMAT_FIT_LABEL[f]}</span>)}
    </div>
  )
}

export function AssetThumb({ a, className = '' }: { a: LibraryAsset; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      <img src={a.previewUrl} alt={a.alt || ''} loading="lazy" className="h-full w-full object-cover" />
      {a.kind === 'video' && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white"><Film size={10} /> Video</span>}
    </div>
  )
}

function AssetDialog({ a, data, workspaceId, onClose, onChanged }: { a: LibraryAsset; data: LibraryData; workspaceId: string; onClose: () => void; onChanged: () => void }) {
  const { titleId, dialogProps } = useDialog(true, onClose)
  const [target, setTarget] = useState(data.targets[0]?.id ?? '')
  const [brand, setBrand] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function use() {
    setBusy('use'); setError(null); setDone(null)
    try {
      await api('/api/admin/marketing/library', { method: 'POST', json: { action: 'use', workspaceId, key: a.key, postId: target, brand } })
      setDone(target)
      onChanged()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(null) }
  }
  async function archive() {
    setBusy('archive'); setError(null)
    try {
      await api('/api/admin/marketing/library', { method: 'POST', json: { action: 'archive', workspaceId, key: a.key, archived: !a.archived } })
      onChanged()
      onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') } finally { setBusy(null) }
  }

  const rows: Array<[string, string | null]> = [
    ['Servicio', a.services.join(', ') || null],
    ['Pilar', a.pillars.join(', ') || null],
    ['Estilo', a.styles.join(', ') || null],
    ['Orientación', a.orientation ? `${ORIENTATION_LABEL[a.orientation as Orientation]}${a.width && a.height ? ` · ${a.width}×${a.height}` : ''}` : null],
    ['Primer uso', a.firstUsedAt ? fmtDate(a.firstUsedAt) : null],
    ['Último uso', a.lastUsedAt ? fmtDate(a.lastUsedAt) : null],
    ['Crédito', a.credit],
    ['Texto alternativo', a.alt],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div {...dialogProps} className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 sm:max-w-4xl sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-gray-900">{a.services[0] || (a.kind === 'video' ? 'Video' : 'Imagen')}</h2>
          <button onClick={onClose} className="-m-2 p-2" aria-label="Cerrar"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <div className="flex items-center justify-center overflow-hidden rounded-2xl bg-gray-900">
            {a.kind === 'video'
              ? <video src={a.url} controls playsInline poster={a.previewUrl} className="max-h-[60dvh] w-full object-contain" />
              : <img src={a.url} alt={a.alt || ''} className="max-h-[60dvh] w-full object-contain" />}
          </div>
          <div className="min-w-0 space-y-4">
            <AssetBadges a={a} />
            <dl className="space-y-1.5 text-sm">
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">{k}</dt><dd className="min-w-0 break-words text-gray-800">{v}</dd></div>
              ))}
            </dl>
            {a.prompt && <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600"><strong className="text-gray-800">Descripción con la que se generó:</strong> {a.prompt}</p>}
            {a.candidate && !a.uses && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">La IA la generó como opción y nadie la eligió: ya está pagada.</p>}
            {a.best && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"><Trophy size={14} className="mt-0.5 shrink-0" /><span>Mejor resultado: <strong>{num(a.best.reach + a.best.webViews)}</strong> de alcance{a.best.engagementRate != null ? ` · ${a.best.engagementRate}% de interacción` : ''} en «{a.best.title}»</span></p>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dónde se usó</p>
              {a.usedIn.length ? a.usedIn.map((u) => (
                <Link key={u.postId} href={`/admin/marketing/posts/${u.postId}`} className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="min-w-0 flex-1 truncate text-gray-800">{u.title}</span>
                  <StatusChip status={u.status} />
                  <span className="shrink-0 text-[11px] text-gray-500">{u.result ? `${num(u.result.reach + u.result.webViews)} alc.` : fmtDate(u.at)}</span>
                </Link>
              )) : <p className="text-sm text-gray-500">En ninguna publicación todavía.</p>}
            </div>

            {data.canEdit && !a.archived && (
              <div className="space-y-2 rounded-2xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">Usar en una publicación</p>
                {data.targets.length ? (
                  <>
                    <select className={input} value={target} onChange={(e) => { setTarget(e.target.value); setDone(null) }}>
                      {data.targets.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.status === 'review' ? 'En revisión' : 'Borrador'}</option>)}
                    </select>
                    {a.kind === 'image' && <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={brand} onChange={(e) => setBrand(e.target.checked)} /> Poner el logo (si hay uno en Marca e imágenes)</label>}
                    <button onClick={use} disabled={!target || Boolean(busy)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
                      {busy === 'use' ? <Loader2 size={15} className="animate-spin" /> : <Repeat2 size={15} />} Usar aquí
                    </button>
                    {done && <p className="text-xs text-emerald-700">Añadida. <Link href={`/admin/marketing/posts/${done}`} className="font-semibold underline">Abrir la publicación</Link></p>}
                  </>
                ) : <p className="text-xs text-gray-500">No hay borradores ni piezas en revisión. Crea una publicación o elige la imagen desde su editor («Sugerir imágenes» → Biblioteca).</p>}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <a href={downloadUrl(a.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><Download size={15} /> Descargar</a>
              {data.canEdit && (
                <button onClick={archive} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {busy === 'archive' ? <Loader2 size={15} className="animate-spin" /> : a.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {a.archived ? 'Devolver a la biblioteca' : 'Archivar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Resources({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<LibraryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LibraryFilters>({ kind: '', service: '', origin: '', orientation: '', usage: '', q: '', archived: false })
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(48)

  const load = useCallback(async () => {
    try {
      setData(await api<LibraryData>(`/api/admin/marketing/library?workspaceId=${workspaceId}`))
      setError(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
  }, [workspaceId])
  useEffect(() => { setData(null); load() }, [load])

  const list = useMemo(() => (data ? filterLibrary(data.assets, filters) : []), [data, filters])
  const unusedAi = data?.assets.filter((a) => a.candidate && !a.uses && !a.archived).length ?? 0
  const set = (k: keyof LibraryFilters, v: string | boolean) => { setFilters((f) => ({ ...f, [k]: v })); setLimit(48) }
  const asset = open ? data?.assets.find((a) => a.key === open) ?? null : null

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  if (!data) return <div className="flex items-center justify-center gap-2 py-10 text-gray-500"><Loader2 className="animate-spin" size={18} /> Cargando la biblioteca…</div>

  const select = (k: keyof LibraryFilters, label: string, opts: Array<[string, string]>) => (
    <select aria-label={label} className={`${input} sm:w-auto`} value={String(filters[k] ?? '')} onChange={(e) => set(k, e.target.value)}>
      <option value="">{label}</option>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )

  return (
    <div className="space-y-4">
      {unusedAi > 0 && (
        <button onClick={() => setFilters((f) => ({ ...f, origin: 'ai', usage: 'unused', archived: false }))} className="flex w-full items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-900">
          <Sparkles size={16} className="mt-0.5 shrink-0" /><span><strong>{unusedAi} {unusedAi === 1 ? 'imagen de IA' : 'imágenes de IA'} sin usar</strong>: se generaron como opciones y nadie las eligió. Ya están pagadas: úsalas antes de generar otras.</span>
        </button>
      )}
      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className={`${input} pl-9`} value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Buscar por servicio, publicación, descripción…" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {select('kind', 'Tipo', [['image', 'Imágenes'], ['video', 'Videos']])}
          {select('service', 'Servicio', data.facets.services.map((s) => [s, s]))}
          {select('origin', 'Origen', data.facets.origins.map((o) => [o, originLabel(o)]))}
          {select('orientation', 'Orientación', (Object.keys(ORIENTATION_LABEL) as Orientation[]).map((o) => [o, ORIENTATION_LABEL[o]]))}
          {select('usage', 'Usadas y sin usar', [['unused', 'Sin usar'], ['used', 'Usadas']])}
          <label className="col-span-2 flex items-center gap-2 px-1 text-sm text-gray-600 sm:col-span-1"><input type="checkbox" checked={Boolean(filters.archived)} onChange={(e) => set('archived', e.target.checked)} /> Ver archivadas</label>
        </div>
      </div>
      <p className="px-1 text-xs text-gray-500">{list.length === 1 ? '1 recurso' : `${num(list.length)} recursos`}</p>
      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.slice(0, limit).map((a) => (
            <button key={a.key} onClick={() => setOpen(a.key)} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:border-primary-200 hover:shadow-sm">
              <AssetThumb a={a} className="aspect-square" />
              <div className="space-y-1.5 p-2.5">
                <AssetBadges a={a} />
                <p className="truncate text-xs font-medium text-gray-800">{a.services[0] || a.alt || 'Sin servicio'}</p>
                {a.best ? <p className="flex items-center gap-1 text-[11px] text-amber-700"><Trophy size={11} /> {num(a.best.reach + a.best.webViews)} de alcance</p> : a.lastUsedAt ? <p className="text-[11px] text-gray-500">Usada el {fmtDate(a.lastUsedAt)}</p> : <p className="text-[11px] text-gray-500">Creada el {fmtDate(a.createdAt)}</p>}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          {data.assets.length ? 'Nada coincide con los filtros.' : 'La biblioteca se llena sola con las imágenes y videos de las publicaciones y con cada imagen que genera la IA.'}
        </div>
      )}
      {list.length > limit && <button onClick={() => setLimit((l) => l + 48)} className="mx-auto block rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Ver más</button>}
      {asset && <AssetDialog a={asset} data={data} workspaceId={workspaceId} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  )
}

function Pieces({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<PieceRow[] | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setRows(null)
    api<{ pieces: PieceRow[]; canEdit: boolean }>(`/api/admin/marketing/library?workspaceId=${workspaceId}&view=pieces`)
      .then((d) => { setRows(d.pieces); setCanEdit(d.canEdit); setError(null) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [workspaceId])

  async function reuse(postId: string) {
    setBusy(postId); setError(null)
    try {
      const d = await api<{ postId: string }>('/api/admin/marketing/library', { method: 'POST', json: { action: 'reuse', workspaceId, postId } })
      router.push(`/admin/marketing/posts/${d.postId}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); setBusy(null) }
  }

  if (!rows && !error) return <div className="flex items-center justify-center gap-2 py-10 text-gray-500"><Loader2 className="animate-spin" size={18} /> Cargando…</div>
  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-gray-500">Publicadas en el último año, primero las que trajeron reservas y solicitudes, luego alcance e interacción. «Reutilizar» crea un borrador con sus textos e imágenes para adaptarlo; nunca se publica solo.</p>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {rows && !rows.length && <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">Todavía no hay publicaciones con resultados.</div>}
      {rows?.map((p, i) => (
        <div key={p.postId} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {p.thumb ? <img src={p.thumb} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary-50 to-secondary-50" />}
              {i < 3 && <span className="absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{i + 1}</span>}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Link href={`/admin/marketing/posts/${p.postId}`} className="line-clamp-2 break-words font-semibold text-gray-900 hover:text-primary-700">{p.title}</Link>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.channels.map((c) => <span key={c} className="inline-flex items-center gap-1"><MkChannelIcon channel={c} size={14} />{p.formats[c] && <FormatPill label={p.formats[c]} size="xs" />}</span>)}
                {p.service && <span className="text-[11px] text-gray-500">{p.service}</span>}
                <span className="text-[11px] text-gray-400">{fmtDate(p.publishedAt)}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
                <span><strong className="text-gray-900">{num(p.bookings)}</strong> reservas</span>
                <span><strong className="text-gray-900">{num(p.requests)}</strong> solicitudes</span>
                <span><strong className="text-gray-900">{num(p.reach + p.webViews)}</strong> alcance</span>
                {p.engagementRate != null && <span><strong className="text-gray-900">{p.engagementRate}%</strong> interacción</span>}
                {p.reeditions > 0 && <span className="text-primary-700">{p.reeditions === 1 ? 'Ya se reeditó 1 vez' : `Ya se reeditó ${p.reeditions} veces`}</span>}
              </div>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => reuse(p.postId)} disabled={Boolean(busy)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy === p.postId ? <Loader2 size={15} className="animate-spin" /> : <Repeat2 size={15} />} Reutilizar
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/** «Biblioteca»: every file of the workspace to reuse (with its results) and the pieces that worked. */
export default function LibraryTab({ workspace }: { workspace: Ws | null }) {
  const [view, setView] = useState<'assets' | 'pieces'>('assets')
  if (!workspace) return <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">Elige un workspace arriba para ver su biblioteca.</div>
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
        {([['assets', 'Recursos'], ['pieces', 'Piezas que funcionaron']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={`rounded-full px-3 py-1.5 text-sm ${view === k ? 'bg-gray-900 font-semibold text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>
      {view === 'assets' ? <Resources workspaceId={workspace.id} /> : <Pieces workspaceId={workspace.id} />}
      <p className="flex items-center gap-1 px-1 text-[11px] text-gray-400"><ExternalLink size={10} /> Los archivos están en Cloudinary: reutilizarlos no los vuelve a subir ni a pagar.</p>
    </div>
  )
}

