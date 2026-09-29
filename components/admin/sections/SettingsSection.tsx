'use client'

import { useEffect, useState } from 'react'
import { Settings, DollarSign, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface PlatformConfig {
  id: string
  commissionRate: number
  clientCommissionRate: number
  partnerCommissionRate: number
  minServicePrice: number
  maxServicePrice: number
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

export default function SettingsSection() {
  const [config, setConfig] = useState<PlatformConfig | null>(null)
  const [form, setForm] = useState({ minServicePrice: 0, maxServicePrice: 0 })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [loadError, setLoadError] = useState('')

  const loadConfig = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/commission-config', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new Error(data?.error || 'No se pudo cargar la configuración')
      setConfig(data)
      setForm({ minServicePrice: Number(data.minServicePrice) || 0, maxServicePrice: Number(data.maxServicePrice) || 0 })
    } catch (e) {
      setConfig(null)
      setLoadError(e instanceof Error ? e.message : 'No se pudo cargar la configuración')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleSave = async () => {
    if (!config) return
    if (form.minServicePrice >= form.maxServicePrice) {
      setErrorMsg('El precio mínimo debe ser menor al máximo.')
      setStatus('error')
      return
    }
    setStatus('saving')
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/commission-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minServicePrice: form.minServicePrice,
          maxServicePrice: form.maxServicePrice,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          data?.error || (res.status === 403 ? 'Solo un superadmin puede cambiar esto' : 'Error al guardar'),
        )
      }
      if (data) setConfig(data)
      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600 mt-1">Ajustes generales de la plataforma</p>
      </div>

      {loadError && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-3"><AlertCircle size={18} className="shrink-0" />{loadError}</span>
          <button
            onClick={loadConfig}
            className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle2 size={18} />
          Configuración guardada correctamente.
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} />
          {errorMsg || 'Error al guardar configuración.'}
        </div>
      )}

      {/* Rango de precios del servicio */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="shrink-0 p-2.5 bg-primary-50 rounded-xl">
            <DollarSign size={20} className="text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Rango de precios del servicio</h2>
            <p className="text-sm text-gray-500">Límites que se aplican al crear y validar servicios en la plataforma</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Precio mínimo (COP)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={form.minServicePrice}
                onChange={e => setForm(f => ({ ...f, minServicePrice: Number(e.target.value) }))}
                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{form.minServicePrice.toLocaleString('es-CO')} COP</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Precio máximo (COP)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                min={0}
                step={10000}
                value={form.maxServicePrice}
                onChange={e => setForm(f => ({ ...f, maxServicePrice: Number(e.target.value) }))}
                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{form.maxServicePrice.toLocaleString('es-CO')} COP</p>
          </div>
        </div>
      </div>

      {/* Comisiones (solo lectura, redirige a sección Comisiones) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="shrink-0 p-2.5 bg-gray-50 rounded-xl">
            <Settings size={20} className="text-gray-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Comisiones actuales</h2>
            <p className="text-sm text-gray-500">Gestiona los porcentajes en la sección <strong>Comisiones</strong> del menú</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Cliente</p>
            <p className="text-2xl font-black text-blue-700">{config?.clientCommissionRate ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Socio</p>
            <p className="text-2xl font-black text-purple-700">{config?.partnerCommissionRate ?? 0}%</p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plataforma</p>
            <p className="text-2xl font-black text-gray-700">{config?.commissionRate ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={status === 'saving' || !config}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-2.5 sm:w-auto bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-all disabled:opacity-50"
        >
          {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {status === 'saving' ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
