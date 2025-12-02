'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CreditCard, Key, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

type PaymentEnvironment = 'TEST' | 'PRODUCTION'

interface PaymentConfig {
  id: string
  environment: PaymentEnvironment
  hasTestCredentials: boolean
  hasProductionCredentials: boolean
  testPublicKey?: string
  productionPublicKey?: string
}

export default function PaymentConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const [environment, setEnvironment] = useState<PaymentEnvironment>('TEST')
  const [testAccessToken, setTestAccessToken] = useState('')
  const [testPublicKey, setTestPublicKey] = useState('')
  const [productionAccessToken, setProductionAccessToken] = useState('')
  const [productionPublicKey, setProductionPublicKey] = useState('')
  
  const [showTestAccessToken, setShowTestAccessToken] = useState(false)
  const [showProductionAccessToken, setShowProductionAccessToken] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchConfig()
    }
  }, [status, session])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/payment-config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setEnvironment(data.environment)
        setTestPublicKey(data.testPublicKey || '')
        setProductionPublicKey(data.productionPublicKey || '')
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment,
          testAccessToken: testAccessToken || undefined,
          testPublicKey: testPublicKey || undefined,
          productionAccessToken: productionAccessToken || undefined,
          productionPublicKey: productionPublicKey || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
        setTestAccessToken('')
        setProductionAccessToken('')
      } else {
        setMessage({ type: 'error', text: 'Error al guardar la configuración' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF2D55]"></div>
      </div>
    )
  }

  if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-[#FF2D55]" />
            Configuración de Pagos
          </h1>
          <p className="mt-2 text-gray-600">
            Configura las credenciales de Mercadopago para ambientes de prueba y producción
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Ambiente Activo</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="environment"
                    value="TEST"
                    checked={environment === 'TEST'}
                    onChange={(e) => setEnvironment(e.target.value as PaymentEnvironment)}
                    className="w-4 h-4 text-[#FF2D55] focus:ring-[#FF2D55]"
                  />
                  <span className="text-gray-700 font-medium">Pruebas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="environment"
                    value="PRODUCTION"
                    checked={environment === 'PRODUCTION'}
                    onChange={(e) => setEnvironment(e.target.value as PaymentEnvironment)}
                    className="w-4 h-4 text-[#FF2D55] focus:ring-[#FF2D55]"
                  />
                  <span className="text-gray-700 font-medium">Producción</span>
                </label>
              </div>
              <p className="text-sm text-gray-500">
                {environment === 'TEST'
                  ? 'Los pagos se procesarán en modo de prueba. No se realizarán cargos reales.'
                  : 'Los pagos se procesarán en modo producción. Se realizarán cargos reales.'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900">Credenciales de Prueba</h2>
              {config?.hasTestCredentials && (
                <span className="ml-auto text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                  Configurado
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Token de Prueba
                </label>
                <div className="relative">
                  <input
                    type={showTestAccessToken ? 'text' : 'password'}
                    value={testAccessToken}
                    onChange={(e) => setTestAccessToken(e.target.value)}
                    placeholder={config?.hasTestCredentials ? '••••••••••••••••' : 'TEST-...'}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTestAccessToken(!showTestAccessToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showTestAccessToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public Key de Prueba
                </label>
                <input
                  type="text"
                  value={testPublicKey}
                  onChange={(e) => setTestPublicKey(e.target.value)}
                  placeholder="TEST-..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Credenciales de Producción</h2>
              {config?.hasProductionCredentials && (
                <span className="ml-auto text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                  Configurado
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Token de Producción
                </label>
                <div className="relative">
                  <input
                    type={showProductionAccessToken ? 'text' : 'password'}
                    value={productionAccessToken}
                    onChange={(e) => setProductionAccessToken(e.target.value)}
                    placeholder={config?.hasProductionCredentials ? '••••••••••••••••' : 'APP_USR-...'}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProductionAccessToken(!showProductionAccessToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showProductionAccessToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public Key de Producción
                </label>
                <input
                  type="text"
                  value={productionPublicKey}
                  onChange={(e) => setProductionPublicKey(e.target.value)}
                  placeholder="APP_USR-..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Importante:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Las credenciales se almacenan de forma segura en la base de datos</li>
                  <li>Solo ingresa nuevas credenciales si deseas actualizarlas</li>
                  <li>Asegúrate de usar el ambiente correcto antes de procesar pagos</li>
                  <li>Obtén tus credenciales desde el panel de Mercadopago</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#FF2D55] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#E02850] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
