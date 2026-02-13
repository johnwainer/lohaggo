'use client'

import { Bell } from 'lucide-react'

export default function NotificationsSection() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notificaciones</h1>
        <p className="text-gray-600">Gestiona las notificaciones del sistema</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <Bell size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Sistema de Notificaciones
        </h3>
        <p className="text-gray-500">
          Esta sección está en desarrollo. Aquí podrás gestionar todas las notificaciones del sistema.
        </p>
      </div>
    </div>
  )
}
