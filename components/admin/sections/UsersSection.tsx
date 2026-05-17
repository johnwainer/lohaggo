'use client'

import { useEffect, useState } from 'react'
import { Shield, Mail, Phone, Calendar, Trash2 } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'
import ConfirmModal from '@/components/ConfirmModal'

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  image: string | null
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

type ConfirmAction = { type: 'delete'; userId: string } | { type: 'toggle'; userId: string; isActive: boolean } | { type: 'role'; userId: string; role: string } | null

export default function UsersSection() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  const executeConfirmAction = async () => {
    if (!confirmAction) return
    setActionError(null)
    try {
      if (confirmAction.type === 'role') {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: confirmAction.userId, role: confirmAction.role }),
        })
        if (!res.ok) throw new Error('Error al actualizar rol')
        fetchUsers()
      } else if (confirmAction.type === 'delete') {
        const res = await fetch(`/api/admin/users?userId=${confirmAction.userId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Error al eliminar usuario')
        fetchUsers()
      } else if (confirmAction.type === 'toggle') {
        const res = await fetch('/api/admin/users/toggle-active', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: confirmAction.userId, isActive: !confirmAction.isActive }),
        })
        if (!res.ok) throw new Error('Error al actualizar estado')
        fetchUsers()
      }
    } catch (err: any) {
      setActionError(err.message)
    } finally {
      setConfirmAction(null)
    }
  }

  const handleRoleChange = (userId: string, newRole: string) => {
    setConfirmAction({ type: 'role', userId, role: newRole })
  }

  const handleDeleteUser = (userId: string) => {
    setConfirmAction({ type: 'delete', userId })
  }

  const handleToggleActive = (userId: string, currentStatus: boolean) => {
    setConfirmAction({ type: 'toggle', userId, isActive: currentStatus })
  }

  const columns = [
    {
      key: 'name',
      label: 'Usuario',
      sortable: true,
      render: (value: string, row: User) => {
        const initials = value.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div className="flex items-center gap-3">
            {row.image ? (
              <img src={row.image} alt={value} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {initials}
              </div>
            )}
            <div>
              <div className="font-medium text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <Mail size={12} />
                {row.email}
              </div>
            </div>
          </div>
        )
      }
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
                Inactivo
              </span>
            )}
          </div>
        )
      }
    },
    {
      key: '_count',
      label: 'Actividad',
      render: (value: any) => (
        <div className="text-sm">
          <div className="text-gray-700">{value.bookings} reservas</div>
          <div className="text-gray-500">{value.serviceRequests} solicitudes</div>
        </div>
      )
    },
    {
      key: 'partnerProfile',
      label: 'Socio',
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
                <span className="text-xs">Verificado</span>
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'createdAt',
      label: 'Registro',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar size={14} />
          {new Date(value).toLocaleDateString('es-CO')}
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
            className="text-xs border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="CLIENT">Cliente</option>
            <option value="PARTNER">Socio</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            onClick={() => handleToggleActive(row.id, row.isActive)}
            className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
              row.isActive
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {row.isActive ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={() => handleDeleteUser(row.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
            title="Eliminar usuario"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mr-3" />
        <span className="text-sm font-medium">Cargando usuarios…</span>
      </div>
    )
  }

  const confirmMessage =
    confirmAction?.type === 'delete'
      ? '¿Eliminar este usuario? Esta acción no se puede deshacer.'
      : confirmAction?.type === 'toggle'
      ? confirmAction.isActive ? '¿Desactivar este usuario?' : '¿Activar este usuario?'
      : '¿Cambiar el rol de este usuario?'

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
        title={confirmAction?.type === 'delete' ? 'Eliminar usuario' : confirmAction?.type === 'toggle' ? 'Cambiar estado' : 'Cambiar rol'}
        message={confirmMessage}
        type={confirmAction?.type === 'delete' ? 'danger' : 'warning'}
        confirmText={confirmAction?.type === 'delete' ? 'Eliminar' : 'Confirmar'}
      />

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {actionError}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <p className="text-gray-600 mt-1">Administra todos los usuarios de la plataforma</p>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todos ({users.length})
        </button>
        <button
          onClick={() => setFilter('CLIENT')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            filter === 'CLIENT'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Clientes
        </button>
        <button
          onClick={() => setFilter('PARTNER')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            filter === 'PARTNER'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Socios
        </button>
        <button
          onClick={() => setFilter('ADMIN')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
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
