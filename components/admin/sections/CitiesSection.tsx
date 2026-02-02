'use client'

import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit2, Trash2, Save, X, Navigation } from 'lucide-react'

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

const statusLabels: Record<CityStatus, string> = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
  COMING_SOON: 'Próximamente'
}

const statusColors: Record<CityStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-red-100 text-red-800',
  COMING_SOON: 'bg-yellow-100 text-yellow-800'
}

export default function CitiesSection() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<City> | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: 'ACTIVE' as CityStatus,
    order: 0,
    latitude: null as number | null,
    longitude: null as number | null,
    isLaunched: false,
    launchDate: null as string | null,
    partnerRegistry: false
  })

  useEffect(() => {
    fetchCities()
  }, [])

  const fetchCities = async () => {
    try {
      const res = await fetch('/api/admin/cities')
      if (res.ok) {
        const data = await res.json()
        setCities(data)
      }
    } catch (error) {
      console.error('Error fetching cities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const dataToSend = {
        ...formData,
        launchDate: formData.isLaunched && formData.launchDate ? new Date(formData.launchDate).toISOString() : null
      }

      const res = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      })

      if (res.ok) {
        await fetchCities()
        setShowAddForm(false)
        setFormData({ name: '', slug: '', status: 'ACTIVE', order: 0, latitude: null, longitude: null, isLaunched: false, launchDate: null, partnerRegistry: false })
      }
    } catch (error) {
      console.error('Error adding city:', error)
    }
  }

  const handleUpdate = async (id: string, data: Partial<City>) => {
    try {
      const res = await fetch(`/api/admin/cities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        await fetchCities()
        setEditingId(null)
        setEditingData(null)
      }
    } catch (error) {
      console.error('Error updating city:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta ciudad?')) return

    try {
      const res = await fetch(`/api/admin/cities/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchCities()
      }
    } catch (error) {
      console.error('Error deleting city:', error)
    }
  }

  const startEditing = (city: City) => {
    setEditingId(city.id)
    setEditingData({ ...city })
  }

  const saveEditing = async () => {
    if (!editingId || !editingData) return

    try {
      const dataToSend = {
        ...editingData,
        launchDate: editingData.isLaunched && editingData.launchDate ? new Date(editingData.launchDate).toISOString() : null
      }
      await handleUpdate(editingId, dataToSend)
    } catch (error) {
      console.error('Error saving changes:', error)
    }
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingData(null)
  }

  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().slice(0, 16)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (

    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Ciudades</h2>
          <p className="text-gray-600 mt-1">Administra las ciudades disponibles en la plataforma</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
        >
          <Plus size={20} />
          Agregar Ciudad
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Nueva Ciudad</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ej.: Medellín"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ej.: medellin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CityStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="ACTIVE">Activa</option>
                <option value="INACTIVE">Inactiva</option>
                <option value="COMING_SOON">Próximamente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orden
              </label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-1">
                  <Navigation size={14} />
                  Latitud
                </div>
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude ?? ''}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ej.: 6.2442"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-1">
                  <Navigation size={14} />
                  Longitud
                </div>
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude ?? ''}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ej.: -75.5812"
              />
            </div>
            {formData.status !== 'ACTIVE' && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.isLaunched}
                    onChange={(e) => setFormData({ ...formData, isLaunched: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  Programar lanzamiento
                </label>
              </div>
            )}
            {formData.isLaunched && formData.status !== 'ACTIVE' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de lanzamiento
                </label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(formData.launchDate)}
                  onChange={(e) => setFormData({ ...formData, launchDate: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}
            {formData.status === 'ACTIVE' && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.partnerRegistry}
                    onChange={(e) => setFormData({ ...formData, partnerRegistry: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  Registro de socios habilitado
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
            >
              <Save size={18} />
              Guardar
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setFormData({ name: '', slug: '', status: 'ACTIVE' as CityStatus, order: 0, latitude: null, longitude: null, isLaunched: false, launchDate: null, partnerRegistry: false })
              }}
              className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              <X size={18} />
              Cancelar
            </button>
          </div>
        </div>
      )
      }

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ciudad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coordenadas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lanzamiento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registro de Socios
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cities.map((city) => (
              <tr key={city.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MapPin className="text-primary-600 mr-2" size={20} />
                    <span className="text-sm font-medium text-gray-900">{city.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{city.slug}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === city.id && editingData ? (
                    <select
                      value={editingData.status}
                      onChange={(e) => setEditingData({ ...editingData, status: e.target.value as CityStatus })}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="ACTIVE">Activa</option>
                      <option value="INACTIVE">Inactiva</option>
                      <option value="COMING_SOON">Próximamente</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[city.status]}`}>
                      {statusLabels[city.status]}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === city.id && editingData ? (
                    <input
                      type="number"
                      value={editingData.order}
                      onChange={(e) => setEditingData({ ...editingData, order: parseInt(e.target.value) })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <span className="text-sm text-gray-600">{city.order}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === city.id && editingData ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={editingData.latitude ?? ''}
                        onChange={(e) => setEditingData({ ...editingData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Latitude"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        value={editingData.longitude ?? ''}
                        onChange={(e) => setEditingData({ ...editingData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Longitude"
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600">
                      {city.latitude != null && city.longitude != null ? (
                        <div className="flex items-center gap-1">
                          <Navigation size={12} className="text-primary-600" />
                          <span>{city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Sin coordenadas</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === city.id && editingData ? (
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editingData.isLaunched}
                          onChange={(e) => setEditingData({ ...editingData, isLaunched: e.target.checked })}
                          disabled={editingData.status === 'ACTIVE'}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        Programado
                      </label>
                      {editingData.isLaunched && editingData.status !== 'ACTIVE' && (
                        <input
                          type="datetime-local"
                          value={formatDateForInput(editingData.launchDate)}
                          onChange={(e) => setEditingData({ ...editingData, launchDate: e.target.value || null })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600">
                      {city.isLaunched && city.status !== 'ACTIVE' ? (
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                            Programado
                          </span>
                          {city.launchDate && (
                            <span className="text-gray-500">
                              {new Date(city.launchDate).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No programado</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === city.id && editingData ? (
                    editingData.status === 'ACTIVE' ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editingData.partnerRegistry}
                          onChange={(e) => setEditingData({ ...editingData, partnerRegistry: e.target.checked })}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        Enabled
                      </label>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Only available for active cities</span>
                    )
                  ) : (
                    <div className="text-xs text-gray-600">
                      {city.status === 'ACTIVE' ? (
                        city.partnerRegistry ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                            Habilitado
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Deshabilitado</span>
                        )
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {editingId === city.id ? (
                      <>
                        <button
                          onClick={saveEditing}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditing(city)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(city.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div >
  )
}
