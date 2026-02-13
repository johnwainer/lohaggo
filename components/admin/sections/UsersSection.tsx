'use client'

import { useEffect, useState } from 'react'
import { Shield, Mail, Phone, Calendar, Trash2, Edit } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
  _count: {
    bookings: number
    serviceRequests: number
  }
  partnerProfile: {
    rating: number
    totalReviews: number
    verified: boolean
    city: string
    isActive: boolean
  } | null
}

export default function UsersSection() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchUsers()
  }, [filter])

  const fetchUsers = async () => {
    try {
      const url = filter === 'all' ? '/api/admin/users' : `/api/admin/users?role=${filter}`
      const res = await fetch(url)
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm('¿Estás seguro de cambiar el rol de este usuario?')) return

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })

      if (res.ok) {
        alert('Rol actualizado exitosamente')
        fetchUsers()
      } else {
        alert('Error al actualizar rol')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Error al actualizar rol')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return

    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        alert('User deleted successfully')
        fetchUsers()
      } else {
        alert('Error deleting user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
    }
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    try {
      const res = await fetch('/api/admin/users/toggle-active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !currentStatus })
      })

      if (res.ok) {
        alert(`User ${action === 'deactivate' ? 'deactivated' : 'activated'} successfully`)
        fetchUsers()
      } else {
        alert(`Error ${action}ing user`)
      }
    } catch (error) {
      console.error(`Error toggling user active status:`, error)
      alert(`Error ${action}ing user`)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Usuario',
      sortable: true,
      render: (value: string, row: User) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <Mail size={12} />
            {row.email}
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (value: string | null) => (
        <div className="flex items-center gap-1 text-gray-600">
          <Phone size={14} />
          {value || 'N/A'}
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value: string, row: User) => {
        const roleColors: Record<string, string> = {
          ADMIN: 'bg-red-100 text-red-800',
          PARTNER: 'bg-purple-100 text-purple-800',
          CLIENT: 'bg-primary-100 text-primary-800'
        }
        const roleLabels: Record<string, string> = {
          CLIENT: 'Client',
          PARTNER: 'Partner',
          ADMIN: 'Admin'
        }
        return (
          <div className="flex flex-col gap-1">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColors[value]}`}>
              {roleLabels[value]}
            </span>
            {!row.isActive && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                Inactive
              </span>
            )}
          </div>
        )
      }
    },
    {
      key: '_count',
      label: 'Activity',
      render: (value: any) => (
        <div className="text-sm">
          <div className="text-gray-700">{value.bookings} bookings</div>
          <div className="text-gray-500">{value.serviceRequests} requests</div>
        </div>
      )
    },
    {
      key: 'partnerProfile',
      label: 'Partner',
      render: (value: any) => {
        if (!value) return <span className="text-gray-400">-</span>
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">★</span>
              <span className="font-medium">{value.rating.toFixed(1)}</span>
              <span className="text-gray-500">({value.totalReviews})</span>
            </div>
            {value.verified && (
              <div className="flex items-center gap-1 text-green-600">
                <Shield size={12} />
                <span className="text-xs">Verified</span>
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'createdAt',
      label: 'Registration',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar size={14} />
          {new Date(value).toLocaleDateString('en-US')}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (_: any, row: User) => (
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => handleRoleChange(row.id, e.target.value)}
            value={row.role}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="CLIENT">Client</option>
            <option value="PARTNER">Partner</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            onClick={() => handleToggleActive(row.id, row.isActive)}
            className={`text-xs px-2 py-1 rounded ${
              row.isActive
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
            title={row.isActive ? 'Deactivate user' : 'Activate user'}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => handleDeleteUser(row.id)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Delete user"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Usuarios</h1>
        <p className="text-gray-600">Administra todos los usuarios de la plataforma</p>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todos ({users.length})
        </button>
        <button
          onClick={() => setFilter('CLIENT')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'CLIENT'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Clientes
        </button>
        <button
          onClick={() => setFilter('PARTNER')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'PARTNER'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Socios
        </button>
        <button
          onClick={() => setFilter('ADMIN')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'ADMIN'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Administradores
        </button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchable
        exportable
        itemsPerPage={15}
      />
    </div>
  )
}
