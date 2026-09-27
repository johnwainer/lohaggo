'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, Download, ListChecks } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'

type SummaryRow = { citySlug: string; cityName: string; client: number; partner: number; pending: number }
type City = { slug: string; name: string; status: string }
type Entry = {
  id: string
  citySlug: string
  email: string
  name: string | null
  role: string
  consentAt: string
  createdAt: string
  notifiedAt: string | null
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const roleLabel = (role: string) => (role === 'partner' ? 'Socio' : 'Cliente')

export default function AdminWaitlistPage() {
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [city, setCity] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmCity, setConfirmCity] = useState<SummaryRow | null>(null)

  const query = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams()
      if (city) p.set('city', city)
      if (role) p.set('role', role)
      for (const [k, v] of Object.entries(extra)) p.set(k, v)
      return p.toString()
    },
    [city, role]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/waitlist?${query({ page: String(page) })}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la lista de espera')
      setSummary(data.summary || [])
      setCities(data.cities || [])
      setEntries(data.entries || [])
      setTotal(data.total || 0)
      setPageSize(data.pageSize || 50)
    } catch (err: any) {
      setError(err.message || 'Error cargando la lista de espera')
    } finally {
      setLoading(false)
    }
  }, [query, page])

  useEffect(() => {
    load()
  }, [load])

  const cityName = (slug: string) => cities.find((c) => c.slug === slug)?.name ?? slug

  const markNotified = async (row: SummaryRow) => {
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citySlug: row.citySlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo marcar')
      setNotice(`${data.updated} registro(s) de ${row.cityName} marcados como avisados.`)
      await load()
    } catch (err: any) {
      setError(err.message || 'No se pudo marcar')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={!!confirmCity}
        onClose={() => setConfirmCity(null)}
        onConfirm={() => {
          if (confirmCity) markNotified(confirmCity)
          setConfirmCity(null)
        }}
        title="Marcar como avisados"
        message={
          confirmCity
            ? `Se marcarán ${confirmCity.pending} registro(s) de ${confirmCity.cityName} como avisados. No se envía ningún mensaje desde aquí.`
            : ''
        }
        type="warning"
        confirmText="Marcar"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ListChecks className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-primary-600" />
            Lista de espera
          </h1>
          <p className="text-gray-600 mt-1">Personas que pidieron aviso cuando LoHaggo llegue a su ciudad.</p>
        </div>
        <a
          href={`/api/admin/waitlist?${query({ format: 'csv' })}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap bg-primary-600 text-white px-4 py-2.5 sm:py-2 rounded-xl font-semibold hover:bg-primary-700 transition"
        >
          <Download size={18} />
          Exportar CSV
        </a>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {summary.length === 0 && !loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 sm:col-span-2 lg:col-span-3">
            Aún no hay registros.
          </div>
        )}
        {summary.map((s) => (
          <div key={s.citySlug} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 truncate">{s.cityName}</p>
                <p className="text-sm text-gray-600">
                  {s.client} cliente{s.client === 1 ? '' : 's'} · {s.partner} socio{s.partner === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Sin avisar: {s.pending}</p>
              </div>
              <button
                type="button"
                disabled={s.pending === 0}
                onClick={() => setConfirmCity(s)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BellRing size={14} />
                Marcar como avisados
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-64 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
          aria-label="Filtrar por ciudad"
        >
          <option value="">Todas las ciudades</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
          aria-label="Filtrar por rol"
        >
          <option value="">Clientes y socios</option>
          <option value="client">Clientes</option>
          <option value="partner">Socios</option>
        </select>
        <p className="text-sm text-gray-500 sm:ml-auto sm:self-center">{total} registro(s)</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No hay registros con estos filtros.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {entries.map((e) => (
              <div key={e.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900 break-all">{e.email}</p>
                {e.name && <p className="text-sm text-gray-700">{e.name}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{cityName(e.citySlug)}</span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">{roleLabel(e.role)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${e.notifiedAt ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}
                  >
                    {e.notifiedAt ? `Avisado ${fmtDate(e.notifiedAt)}` : 'Sin avisar'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">Registrado {fmtDate(e.createdAt)}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Ciudad</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Registrado</th>
                  <th className="px-4 py-3 font-semibold">Avisado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-gray-900">{e.email}</td>
                    <td className="px-4 py-3 text-gray-700">{e.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{cityName(e.citySlug)}</td>
                    <td className="px-4 py-3 text-gray-700">{roleLabel(e.role)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDate(e.notifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
