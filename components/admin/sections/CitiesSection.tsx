'use client'

import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit2, Trash2, Save, X } from 'lucide-react'

interface City {
  id: string
  name: string
  slug: string
  active: boolean
  order: number
}

export default function CitiesSection() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    active: true,
    order: 0
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
      const res = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        await fetchCities()
        setShowAddForm(false)
        setFormData({ name: '', slug: '', active: true, order: 0 })
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
      }
    } catch (error) {
      console.error('Error updating city:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this city?')) return

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

  const handleToggleActive = async (city: City) => {
    await handleUpdate(city.id, { active: !city.active })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF2D55]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Cities Management</h1>
          <p className="text-gray-600 mt-1">Manage available cities and their status</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-4 py-2 rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add City</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Add New City</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                placeholder="e.g., Medellín"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                placeholder="e.g., medellin"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Order
              </label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 text-[#FF2D55] border-gray-300 rounded focus:ring-[#FF2D55]"
                />
                <span className="text-sm font-semibold text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAdd}
              className="flex-1 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Save City
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold">City</th>
                <th className="px-6 py-4 text-left text-sm font-bold">Slug</th>
                <th className="px-6 py-4 text-left text-sm font-bold">Order</th>
                <th className="px-6 py-4 text-left text-sm font-bold">Status</th>
                <th className="px-6 py-4 text-right text-sm font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cities.map((city) => (
                <tr key={city.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-[#FF2D55]" />
                      <span className="font-semibold text-gray-900">{city.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">{city.slug}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">{city.order}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(city)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        city.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {city.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDelete(city.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
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

        {cities.length === 0 && (
          <div className="text-center py-12">
            <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No cities found</p>
            <p className="text-gray-400 text-sm mt-1">Add your first city to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
