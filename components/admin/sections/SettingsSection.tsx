'use client'

import { Settings } from 'lucide-react'

export default function SettingsSection() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración</h1>
        <p className="text-gray-600">Ajustes generales de la plataforma</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <Settings size={64} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Configuración del Sistema
        </h3>
        <p className="text-gray-500">
          Esta sección está en desarrollo. Aquí podrás configurar los ajustes generales de la plataforma.
        </p>
      </div>
    </div>
  )
}
