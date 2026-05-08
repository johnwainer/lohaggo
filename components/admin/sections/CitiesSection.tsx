'use client'

import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit2, Trash2, Save, X, Navigation, Calendar, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react'

type CityStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON'

interface City {
  id: string
  name: string
  slug: string
  status: CityStatus
  order: number
  latitude: number | null
  longitude: number | null
  isLaunched: boolean
  launchDate: string | null
  partnerRegistry: boolean
}

const EMPTY_FORM: Omit<City, 'id'> = {
  name: '',
  slug: '',
  status: 'ACTIVE',
  order: 0,
  latitude: null,
  longitude: null,
  isLaunched: false,
  launchDate: null,
  partnerRegistry: false,
}

function formatLaunchDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function toDateInput(dateStr: string | null): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

function LaunchBadge({ city }: { city: City }) {
  if (!city.launchDate) return <span className="text-gray-400 text-xs italic">Sin fecha</span>
  const days = daysUntil(city.launchDate)
  if (days === null) return null
  if (days > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
          <Clock size={11} /> En {days} días
        </span>
        <span className="text-xs text-gray-500">{formatLaunchDate(city.launchDate)}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
        <CheckCircle size={11} /> Disponible
      </span>
      <span className="text-xs text-gray-500">{formatLaunchDate(city.launchDate)}</span>
    </div>
  )
}

function CityForm({
  data,
  onChange,
  onSave,
  onCancel,
  saveLabel = 'Guardar',
}: {
  data: Omit<City, 'id'>
  onChange: (d: Omit<City, 'id'>) => void
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
}) {
  return (
    <div className="space-y-5">
      {/* Identificación */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Nombre</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ej.: Medellín"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Slug</label>
          <input
            type="text"
            value={data.slug}
            onChange={(e) => onChange({ ...data, slug: e.target.value.toLowerCase() })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ej.: medellin"
          />
        </div>
      </div>

      {/* Estado y orden */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Estado operativo</label>
          <select
            value={data.status}
            onChange={(e) => onChange({ ...data, status: e.target.value as CityStatus })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="ACTIVE">Activa</option>
            <option value="COMING_SOON">Próximamente</option>
            <option value="INACTIVE">Inactiva</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Orden</label>
          <input
            type="number"
            value={data.order}
            onChange={(e) => onChange({ ...data, order: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lanzamiento para clientes */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
          <Calendar size={13} /> Disponibilidad para clientes
        </p>
        <p className="text-xs text-blue-600">Fecha en que los clientes podrán solicitar servicios en esta ciudad.</p>
        <input
          type="date"
          value={toDateInput(data.launchDate)}
          onChange={(e) => onChange({ ...data, launchDate: e.target.value ? e.target.value + 'T00:00:00.000Z' : null })}
          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
        {data.launchDate && daysUntil(data.launchDate) !== null && (
          <p className="text-xs text-blue-700 font-medium">
            {daysUntil(data.launchDate)! > 0
              ? `⏳ Lanza en ${daysUntil(data.launchDate)} días — ${formatLaunchDate(data.launchDate)}`
              : `✅ Ya disponible desde ${formatLaunchDate(data.launchDate)}`}
          </p>
        )}
      </div>

      {/* Registro de socios */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.partnerRegistry}
            onChange={(e) => onChange({ ...data, partnerRegistry: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
          />
          <div>
            <p className="text-sm font-semibold text-green-800 flex items-center gap-1">
              <Users size={14} /> Registro de socios habilitado
            </p>
            <p className="text-xs text-green-600 mt-0.5">Los socios podrán registrarse para operar en esta ciudad.</p>
          </div>
        </label>
      </div>

      {/* Coordenadas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            <span className="flex items-center gap-1"><Navigation size={11} /> Latitud</span>
          </label>
          <input
            type="number"
            step="0.0001"
            value={data.latitude ?? ''}
            onChange={(e) => onChange({ ...data, latitude: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="6.2442"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            <span className="flex items-center gap-1"><Navigation size={11} /> Longitud</span>
          </label>
          <input
            type="number"
            step="0.0001"
            value={data.longitude ?? ''}
            onChange={(e) => onChange({ ...data, longitude: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="-75.5812"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
        >
          <Save size={16} /> {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
        >
          <X size={16} /> Cancelar
        </button>
      </div>
    </div>
  )
}

const statusBadge: Record<CityStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  ACTIVE: { label: 'Activa', cls: 'bg-green-100 text-green-800', icon: <CheckCircle size={11} /> },
  INACTIVE: { label: 'Inactiva', cls: 'bg-red-100 text-red-800', icon: <AlertCircle size={11} /> },
  COMING_SOON: { label: 'Próximamente', cls: 'bg-yellow-100 text-yellow-800', icon: <Clock size={11} /> },
}

export default function CitiesSection() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Omit<City, 'id'> | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCity, setNewCity] = useState<Omit<City, 'id'>>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => { fetchCities() }, [])

  const fetchCities = async () => {
    try {
      const res = await fetch('/api/admin/cities')
      if (res.ok) setCities(await res.json())
    } catch (e) {
      console.error('Error fetching cities:', e)
    } finally {
      setLoading(false)
    }
  }

  const buildPayload = (data: Omit<City, 'id'>) => ({
    name: data.name,
    slug: data.slug,
    status: data.status,
    order: data.order,
    latitude: data.latitude,
    longitude: data.longitude,
    isLaunched: data.isLaunched,
    launchDate: data.launchDate ? new Date(data.launchDate).toISOString() : null,
    partnerRegistry: data.partnerRegistry,
  })

  const handleAdd = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(newCity)),
      })
      if (res.ok) {
        await fetchCities()
        setShowAddForm(false)
        setNewCity({ ...EMPTY_FORM })
      } else {
        const err = await res.json()
        setSaveError(err.error || 'Error al crear ciudad')
      }
    } catch (e) {
      setSaveError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editingData) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/cities/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(editingData)),
      })
      if (res.ok) {
        await fetchCities()
        setEditingId(null)
        setEditingData(null)
      } else {
        const err = await res.json()
        setSaveError(err.error || 'Error al guardar')
      }
    } catch (e) {
      setSaveError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta ciudad? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`/api/admin/cities/${id}`, { method: 'DELETE' })
      if (res.ok) fetchCities()
    } catch (e) {
      console.error('Error deleting city:', e)
    }
  }

  const startEditing = (city: City) => {
    setEditingId(city.id)
    setEditingData({ name: city.name, slug: city.slug, status: city.status, order: city.order, latitude: city.latitude, longitude: city.longitude, isLaunched: city.isLaunched, launchDate: city.launchDate, partnerRegistry: city.partnerRegistry })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium flex items-center gap-2">
          <AlertCircle size={16} /> {saveError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Ciudades</h2>
          <p className="text-gray-500 mt-1 text-sm">Configura el estado operativo y la disponibilidad para clientes de cada ciudad.</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null) }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
        >
          <Plus size={18} /> Nueva Ciudad
        </button>
      </div>

      {/* Formulario nueva ciudad */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-primary-600" /> Nueva Ciudad
          </h3>
          <CityForm
            data={newCity}
            onChange={setNewCity}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setNewCity({ ...EMPTY_FORM }) }}
            saveLabel={saving ? 'Guardando…' : 'Crear Ciudad'}
          />
        </div>
      )}

      {/* Cards de ciudades */}
      <div className="grid gap-4">
        {cities.map((city) => {
          const badge = statusBadge[city.status]
          const isEditing = editingId === city.id

          return (
            <div key={city.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Header de la card */}
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                    <MapPin size={20} className="text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{city.name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                        {badge.icon} {badge.label}
                      </span>
                      {city.partnerRegistry && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                          <Users size={11} /> Socios abierto
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 font-mono">/{city.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button onClick={handleSaveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold transition disabled:opacity-50">
                        <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button onClick={() => { setEditingId(null); setEditingData(null) }} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs transition">
                        <X size={13} /> Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditing(city)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(city.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Cuerpo */}
              {isEditing && editingData ? (
                <div className="px-6 py-5">
                  <CityForm
                    data={editingData}
                    onChange={setEditingData}
                    onSave={handleSaveEdit}
                    onCancel={() => { setEditingId(null); setEditingData(null) }}
                    saveLabel={saving ? 'Guardando…' : 'Guardar cambios'}
                  />
                </div>
              ) : (
                <div className="px-6 py-4 grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Calendar size={11} /> Disponible para clientes
                    </p>
                    <LaunchBadge city={city} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Users size={11} /> Registro de socios
                    </p>
                    {city.partnerRegistry ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-xs">
                        <CheckCircle size={13} /> Habilitado
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Deshabilitado</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Navigation size={11} /> Coordenadas
                    </p>
                    {city.latitude != null && city.longitude != null ? (
                      <span className="text-xs text-gray-600 font-mono">{city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}</span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sin coordenadas</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {cities.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <MapPin size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay ciudades configuradas</p>
            <p className="text-sm mt-1">Agrega la primera ciudad con el botón de arriba.</p>
          </div>
        )}
      </div>
    </div>
  )
}
