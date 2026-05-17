'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, Plus, Save, Trash2, X } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'

type BankRow = {
  id: string
  code: string
  name: string
  country: string
  isActive: boolean
  sortOrder: number
  accountNumberMinLength: number
  accountNumberMaxLength: number
  supportsSavings: boolean
  supportsChecking: boolean
}

const EMPTY_FORM = {
  code: '',
  name: '',
  country: 'CO',
  isActive: true,
  sortOrder: 0,
  accountNumberMinLength: 8,
  accountNumberMaxLength: 20,
  supportsSavings: true,
  supportsChecking: true,
}

export default function AdminBanksPage() {
  const [banks, setBanks] = useState<BankRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<BankRow>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankRow | null>(null)

  const activeCount = useMemo(() => banks.filter((bank) => bank.isActive).length, [banks])

  const fetchBanks = async () => {
    try {
      const res = await fetch('/api/admin/banks')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el catálogo de bancos')
      setBanks(data.banks || [])
    } catch (err: any) {
      setError(err.message || 'Error cargando bancos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanks()
  }, [])

  const handleCreate = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el banco')

      setForm(EMPTY_FORM)
      setShowCreate(false)
      await fetchBanks()
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el banco')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/banks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar')

      setEditingId(null)
      setEditing({})
      await fetchBanks()
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/banks/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      await fetchBanks()
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar')
    } finally {
      setSaving(false)
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDelete(deleteTarget.id)
          }
        }}
        title="Eliminar banco"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}" del catálogo? Esta acción no se puede deshacer.` : ''}
        type="danger"
        confirmText="Eliminar"
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary-600" />
            Catálogo de Bancos
          </h1>
          <p className="text-gray-600 mt-1">
            Administra los bancos que ven los socios al registrar datos bancarios.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Total: {banks.length} bancos · Activos: {activeCount}
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-primary-700 transition"
        >
          <Plus size={18} />
          Nuevo banco
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 grid md:grid-cols-4 gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="Código (ej: NEQUI)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Nombre del banco" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="País" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
          <input type="number" className="border rounded-lg px-3 py-2" placeholder="Orden" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
          <input type="number" className="border rounded-lg px-3 py-2" placeholder="Min cuenta" value={form.accountNumberMinLength} onChange={(e) => setForm({ ...form, accountNumberMinLength: Number(e.target.value) || 8 })} />
          <input type="number" className="border rounded-lg px-3 py-2" placeholder="Max cuenta" value={form.accountNumberMaxLength} onChange={(e) => setForm({ ...form, accountNumberMaxLength: Number(e.target.value) || 20 })} />
          <div className="flex items-center gap-4 md:col-span-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.supportsSavings} onChange={(e) => setForm({ ...form, supportsSavings: e.target.checked })} /> Ahorros</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.supportsChecking} onChange={(e) => setForm({ ...form, supportsChecking: e.target.checked })} /> Corriente</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Activo</label>
          </div>
          <div className="md:col-span-4 flex items-center gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM) }} className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg text-gray-700">
              <X size={16} /> Cancelar
            </button>
            <button disabled={saving} onClick={handleCreate} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50">
              <Save size={16} /> Guardar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">País</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Cuenta</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Tipos</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((bank) => {
              const isEditing = editingId === bank.id
              return (
                <tr key={bank.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 w-28" value={editing.code ?? bank.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
                    ) : bank.code}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 w-72" value={editing.name ?? bank.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    ) : bank.name}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 w-16" value={editing.country ?? bank.country} onChange={(e) => setEditing({ ...editing, country: e.target.value.toUpperCase() })} />
                    ) : bank.country}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input type="number" className="border rounded px-2 py-1 w-16" value={editing.accountNumberMinLength ?? bank.accountNumberMinLength} onChange={(e) => setEditing({ ...editing, accountNumberMinLength: Number(e.target.value) })} />
                        <span>-</span>
                        <input type="number" className="border rounded px-2 py-1 w-16" value={editing.accountNumberMaxLength ?? bank.accountNumberMaxLength} onChange={(e) => setEditing({ ...editing, accountNumberMaxLength: Number(e.target.value) })} />
                      </div>
                    ) : `${bank.accountNumberMinLength}-${bank.accountNumberMaxLength}`}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={editing.supportsSavings ?? bank.supportsSavings} onChange={(e) => setEditing({ ...editing, supportsSavings: e.target.checked })} /> Aho</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={editing.supportsChecking ?? bank.supportsChecking} onChange={(e) => setEditing({ ...editing, supportsChecking: e.target.checked })} /> Cte</label>
                      </div>
                    ) : (
                      <span>{bank.supportsSavings ? 'Ahorros' : ''}{bank.supportsSavings && bank.supportsChecking ? ' · ' : ''}{bank.supportsChecking ? 'Corriente' : ''}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive ?? bank.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Activo</label>
                    ) : (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${bank.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {bank.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleSave(bank.id)} className="inline-flex items-center gap-1 text-sm px-2 py-1 bg-primary-600 text-white rounded" disabled={saving}>
                          <Save size={14} /> Guardar
                        </button>
                        <button onClick={() => { setEditingId(null); setEditing({}) }} className="inline-flex items-center gap-1 text-sm px-2 py-1 border rounded">
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingId(bank.id); setEditing({}) }} className="text-sm px-2 py-1 border rounded">Editar</button>
                        <button onClick={() => setDeleteTarget(bank)} className="inline-flex items-center gap-1 text-sm px-2 py-1 border border-red-200 text-red-600 rounded">
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
