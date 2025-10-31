'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Save, AlertCircle } from 'lucide-react'

export default function CommissionsSection() {
  const [config, setConfig] = useState({
    clientCommissionRate: 0,
    partnerCommissionRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/commission-config')
      if (response.ok) {
        const data = await response.json()
        setConfig({
          clientCommissionRate: data.clientCommissionRate,
          partnerCommissionRate: data.partnerCommissionRate,
        })
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/commission-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Error al guardar configuración' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración' })
    } finally {
      setSaving(false)
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Configuración de Comisiones</h2>
          <p className="text-gray-600 mt-1">
            Define los porcentajes de comisión para clientes y socios
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Comisión Cliente</h3>
              <p className="text-sm text-gray-600">Porcentaje adicional al precio del servicio</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Porcentaje (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={config.clientCommissionRate}
                onChange={(e) =>
                  setConfig({ ...config, clientCommissionRate: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Ejemplo:</strong> Si el servicio cuesta $100,000 COP y la comisión es del{' '}
                {config.clientCommissionRate}%, el cliente pagará:
              </p>
              <p className="text-lg font-bold text-blue-600 mt-2">
                ${(100000 * (1 + config.clientCommissionRate / 100)).toLocaleString('es-CO')} COP
              </p>
              <p className="text-xs text-gray-600 mt-1">
                (Servicio: $100,000 + Comisión: $
                {(100000 * (config.clientCommissionRate / 100)).toLocaleString('es-CO')})
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Comisión Socio</h3>
              <p className="text-sm text-gray-600">Porcentaje descontado del pago al socio</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Porcentaje (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={config.partnerCommissionRate}
                onChange={(e) =>
                  setConfig({ ...config, partnerCommissionRate: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Ejemplo:</strong> Si el servicio cuesta $100,000 COP y la comisión es del{' '}
                {config.partnerCommissionRate}%, el socio recibirá:
              </p>
              <p className="text-lg font-bold text-purple-600 mt-2">
                ${(100000 * (1 - config.partnerCommissionRate / 100)).toLocaleString('es-CO')} COP
              </p>
              <p className="text-xs text-gray-600 mt-1">
                (Servicio: $100,000 - Comisión: $
                {(100000 * (config.partnerCommissionRate / 100)).toLocaleString('es-CO')})
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Resumen del Flujo de Pagos</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <span className="font-bold text-[#FF2D55]">1.</span>
            <p>
              El cliente paga el precio del servicio <strong>MÁS</strong> la comisión de cliente (
              {config.clientCommissionRate}%)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-[#FF2D55]">2.</span>
            <p>MercadoPago procesa el pago y notifica a la plataforma</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-[#FF2D55]">3.</span>
            <p>
              Al pagar al socio, se le descuenta la comisión de socio ({config.partnerCommissionRate}
              %) del precio del servicio
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-[#FF2D55]">4.</span>
            <p>
              La plataforma retiene: comisión de cliente + comisión de socio + tarifas de MercadoPago
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[#FF2D55] text-white rounded-lg hover:bg-[#E6194B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  )
}
