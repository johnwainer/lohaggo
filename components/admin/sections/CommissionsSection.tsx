'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Save, AlertCircle, Banknote, CreditCard, ArrowRightLeft, Percent } from 'lucide-react'

export default function CommissionsSection() {
  const [config, setConfig] = useState({
    clientCommissionRate: 0,
    partnerCommissionRate: 0,
    commissionEnabled: false,
    cashEnabled: true,
    transferEnabled: true,
    mercadoPagoEnabled: false,
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
          commissionEnabled: data.commissionEnabled ?? false,
          cashEnabled: data.cashEnabled ?? true,
          transferEnabled: data.transferEnabled ?? true,
          mercadoPagoEnabled: data.mercadoPagoEnabled ?? false,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración de Comisiones</h1>
        <p className="text-gray-600 mt-1">
          Define los porcentajes de comisión para clientes y socios
        </p>
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
        <h3 className="font-semibold text-gray-900 mb-4">Metodos de pago habilitados</h3>
        <p className="text-sm text-gray-600 mb-4">
          Controla que metodos puede usar el cliente al reportar el pago. La transferencia muestra los datos
          bancarios registrados por el socio. La comision aplica solo si esta activada.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleRow
            icon={<Banknote className="w-5 h-5 text-emerald-600" />}
            label="Efectivo"
            description="Cliente paga en efectivo al socio"
            checked={config.cashEnabled}
            onChange={(v) => setConfig({ ...config, cashEnabled: v })}
          />
          <ToggleRow
            icon={<ArrowRightLeft className="w-5 h-5 text-blue-600" />}
            label="Transferencia directa"
            description="Cliente transfiere a la cuenta del socio"
            checked={config.transferEnabled}
            onChange={(v) => setConfig({ ...config, transferEnabled: v })}
          />
          <ToggleRow
            icon={<CreditCard className="w-5 h-5 text-purple-600" />}
            label="Mercado Pago"
            description="Pago online con tarjeta via MP"
            checked={config.mercadoPagoEnabled}
            onChange={(v) => setConfig({ ...config, mercadoPagoEnabled: v })}
          />
          <ToggleRow
            icon={<Percent className="w-5 h-5 text-amber-600" />}
            label="Cobrar comision"
            description="Aplica % de comision a cliente y socio"
            checked={config.commissionEnabled}
            onChange={(v) => setConfig({ ...config, commissionEnabled: v })}
            warning={!config.commissionEnabled ? undefined : 'Afecta payouts existentes'}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Resumen del Flujo de Pagos</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <span className="font-bold text-primary-600">1.</span>
            <p>
              El cliente paga el precio del servicio <strong>MÁS</strong> la comisión de cliente (
              {config.clientCommissionRate}%)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-primary-600">2.</span>
            <p>MercadoPago procesa el pago y notifica a la plataforma</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-primary-600">3.</span>
            <p>
              Al pagar al socio, se le descuenta la comisión de socio ({config.partnerCommissionRate}
              %) del precio del servicio
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-primary-600">4.</span>
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
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  warning,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  warning?: string
}) {
  return (
    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-600">{description}</p>
        {warning ? <p className="text-xs text-amber-600 mt-1">⚠ {warning}</p> : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5 accent-primary-600"
      />
    </label>
  )
}
