'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff, ExternalLink, TrendingUp, Image as ImageIcon } from 'lucide-react'
import ImageEditor from '@/components/ads/ImageEditor'

interface Service {
  id: string
  name: string
  slug: string
}

interface City {
  id: string
  name: string
  slug: string
  status: string
}

interface Advertisement {
  id: string
  title: string
  imageUrl: string
  linkUrl: string | null
  placement: 'HOME' | 'SERVICE'
  serviceId: string | null
  cityId: string
  active: boolean
  startDate: string
  endDate: string | null
  priority: number
  impressions: number
  clicks: number
  createdAt: string
  updatedAt: string
  service?: Service
  city?: City
}

export default function AdsAdminPage() {
  const [ads, setAds] = useState<Advertisement[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    placement: 'HOME' as 'HOME' | 'SERVICE',
    serviceId: '',
    cityId: '',
    active: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    priority: 0
  })

  useEffect(() => {
    fetchAds()
    fetchServices()
    fetchCities()
  }, [])

  const toArray = <T,>(payload: unknown, key?: string): T[] => {
    if (Array.isArray(payload)) return payload as T[]
    if (payload && typeof payload === 'object' && key) {
      const nested = (payload as Record<string, unknown>)[key]
      if (Array.isArray(nested)) return nested as T[]
    }
    return []
  }

  const fetchCities = async () => {
    try {
      const response = await fetch('/api/cities')
      const data = await response.json()
      const cityList = toArray<City>(data, 'cities')
      setCities(cityList.filter((city) => city.status === 'ACTIVE'))
    } catch (error) {
      console.error('Error fetching cities:', error)
      setCities([])
    }
  }

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services')
      const data = await response.json()
      setServices(toArray<Service>(data, 'services'))
    } catch (error) {
      console.error('Error fetching services:', error)
      setServices([])
    }
  }

  const fetchAds = async () => {
    try {
      const response = await fetch('/api/ads?admin=true')
      const data = await response.json()
      setAds(toArray<Advertisement>(data, 'ads'))
    } catch (error) {
      console.error('Error fetching ads:', error)
      setAds([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingAd ? `/api/ads/${editingAd.id}` : '/api/ads'
      const method = editingAd ? 'PATCH' : 'POST'

      const payload = {
        ...formData,
        serviceId: formData.placement === 'SERVICE' && formData.serviceId ? formData.serviceId : null
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        await fetchAds()
        resetForm()
      } else {
        const error = await response.json()
        alert(error.error || 'Error saving ad')
      }
    } catch (error) {
      console.error('Error saving ad:', error)
      alert('Error saving ad')
    }
  }

  const handleToggleActive = async (ad: Advertisement, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const response = await fetch(`/api/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !ad.active })
      })
      if (response.ok) {
        await fetchAds()
      }
    } catch (error) {
      console.error('Error toggling ad:', error)
    }
  }

  const handleEdit = (ad: Advertisement, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingAd(ad)
    setFormData({
      title: ad.title,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl || '',
      placement: ad.placement,
      serviceId: ad.serviceId || '',
      cityId: ad.cityId,
      active: ad.active,
      startDate: ad.startDate.split('T')[0],
      endDate: ad.endDate ? ad.endDate.split('T')[0] : '',
      priority: ad.priority
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('¿Estás seguro de eliminar este anuncio?')) return

    try {
      const response = await fetch(`/api/ads/${id}`, { method: 'DELETE' })
      if (response.ok) {
        await fetchAds()
      }
    } catch (error) {
      console.error('Error deleting ad:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingAd(null)
    setFormData({
      title: '',
      imageUrl: '',
      linkUrl: '',
      placement: 'HOME',
      serviceId: '',
      cityId: '',
      active: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      priority: 0
    })
  }

  const getCTR = (ad: Advertisement) => {
    if (ad.impressions === 0) return '0%'
    return ((ad.clicks / ad.impressions) * 100).toFixed(2) + '%'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Publicidad</h1>
          <p className="text-gray-600 mt-2">Administra los banners publicitarios de la plataforma</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-primary-500 via-secondary-500 to-secondary-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Nuevo Anuncio
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {editingAd ? 'Editar Anuncio' : 'Nuevo Anuncio'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Imagen del Banner
                </label>

                {formData.imageUrl ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImageEditor(true)}
                        className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg hover:bg-white transition-all flex items-center gap-2 font-semibold text-sm shadow-lg"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Cambiar Imagen
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Dimensiones: 1200x200px (Relación 6:1)
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowImageEditor(true)}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-primary-500 hover:bg-gray-50 transition-all"
                  >
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-semibold">
                      Click para subir y editar imagen
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Dimensiones: 1200x200px - JPG, PNG o WebP (máx. 5MB)
                    </p>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL de destino (opcional)
                </label>
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ubicación
                </label>
                <select
                  value={formData.placement}
                  onChange={(e) => setFormData({ ...formData, placement: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="HOME">Home</option>
                  <option value="SERVICE">Servicio</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ciudad
                </label>
                <select
                  value={formData.cityId}
                  onChange={(e) => setFormData({ ...formData, cityId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecciona una ciudad</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.placement === 'SERVICE' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Servicio
                  </label>
                  <select
                    value={formData.serviceId}
                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required={formData.placement === 'SERVICE'}
                  >
                    <option value="">Selecciona un servicio</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Fecha de fin (opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Prioridad (mayor número = mayor prioridad)
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  min="0"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="active" className="text-sm font-semibold text-gray-700">
                  Anuncio activo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-primary-500 via-secondary-500 to-secondary-500 text-white py-3 rounded-xl hover:shadow-lg transition-all font-semibold"
                >
                  {editingAd ? 'Actualizar' : 'Crear'} Anuncio
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 transition-all font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {ads.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl">
            <p className="text-gray-500 text-lg">No hay anuncios creados</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-primary-600 hover:text-secondary-500 font-semibold"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          ads.map((ad) => (
            <div
              key={ad.id}
              className={`bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-all ${
                !ad.active ? 'opacity-60 border-2 border-gray-300' : ''
              }`}
            >
              <div className="flex gap-6">
                <div className="w-80 h-32 flex-shrink-0 relative">
                  <img
                    src={ad.imageUrl}
                    alt={ad.title}
                    className={`w-full h-full object-cover rounded-xl ${
                      !ad.active ? 'grayscale' : ''
                    }`}
                  />
                  {!ad.active && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg">INACTIVO</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className={`text-xl font-bold ${ad.active ? 'text-gray-900' : 'text-gray-500'}`}>
                        {ad.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                          {ad.placement}
                        </span>
                        <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                          {ad.city?.name || 'Sin ciudad'}
                        </span>
                        {ad.service && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                            {ad.service.name}
                          </span>
                        )}
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {ad.active ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="text-sm text-gray-500">
                          Prioridad: {ad.priority}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleActive(ad, e)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={ad.active ? 'Desactivar' : 'Activar'}
                      >
                        {ad.active ? (
                          <Eye className="w-5 h-5 text-green-600" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(ad, e)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5 text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(ad.id, e)
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                      {ad.linkUrl && (
                        <a
                          href={ad.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ver destino"
                        >
                          <ExternalLink className="w-5 h-5 text-gray-600" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-semibold">Impresiones</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{ad.impressions.toLocaleString()}</p>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-green-600 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-semibold">Clicks</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{ad.clicks.toLocaleString()}</p>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-semibold">CTR</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-700">{getCTR(ad)}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-500">
                    <span>Inicio: {new Date(ad.startDate).toLocaleDateString()}</span>
                    {ad.endDate && (
                      <span className="ml-4">Fin: {new Date(ad.endDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showImageEditor && (
        <ImageEditor
          placement={formData.placement}
          onImageUploaded={(url) => {
            setFormData({ ...formData, imageUrl: url })
            setShowImageEditor(false)
          }}
          onCancel={() => setShowImageEditor(false)}
        />
      )}
    </div>
  )
}
