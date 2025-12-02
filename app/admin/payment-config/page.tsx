'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import { CreditCard, Key, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

type PaymentEnvironment = 'TEST' | 'PRODUCTION'

interface PaymentConfig {
  id: string
  environment: PaymentEnvironment
  hasTestCredentials: boolean
  hasProductionCredentials: boolean
  testPublicKey?: string
  testClientId?: string
  productionPublicKey?: string
  productionClientId?: string
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
  const [testClientId, setTestClientId] = useState('')
  const [testClientSecret, setTestClientSecret] = useState('')
  const [productionAccessToken, setProductionAccessToken] = useState('')
  const [productionPublicKey, setProductionPublicKey] = useState('')
  const [productionClientId, setProductionClientId] = useState('')
  const [productionClientSecret, setProductionClientSecret] = useState('')

  const [showTestAccessToken, setShowTestAccessToken] = useState(false)
  const [showTestClientSecret, setShowTestClientSecret] = useState(false)
  const [showProductionAccessToken, setShowProductionAccessToken] = useState(false)
  const [showProductionClientSecret, setShowProductionClientSecret] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [status, session?.user?.role, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.role])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/payment-config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setEnvironment(data.environment)
        setTestPublicKey(data.testPublicKey || '')
        setTestClientId(data.testClientId || '')
        setProductionPublicKey(data.productionPublicKey || '')
        setProductionClientId(data.productionClientId || '')
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
          testClientId: testClientId || undefined,
          testClientSecret: testClientSecret || undefined,
          productionAccessToken: productionAccessToken || undefined,
          productionPublicKey: productionPublicKey || undefined,
          productionClientId: productionClientId || undefined,
          productionClientSecret: productionClientSecret || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
        setTestAccessToken('')
        setTestClientSecret('')
        setProductionAccessToken('')
        setProductionClientSecret('')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#FF2D55] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection="payment-config" onSectionChange={() => router.push('/admin')} />
      <main className="flex-1 overflow-auto ml-0 lg:ml-64">
        <div className="p-3 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID de Prueba
                </label>
                <input
                  type="text"
                  value={testClientId}
                  onChange={(e) => setTestClientId(e.target.value)}
                  placeholder="Client ID..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret de Prueba
                </label>
                <div className="relative">
                  <input
                    type={showTestClientSecret ? 'text' : 'password'}
                    value={testClientSecret}
                    onChange={(e) => setTestClientSecret(e.target.value)}
                    placeholder={config?.hasTestCredentials ? '••••••••••••••••' : 'Client Secret...'}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTestClientSecret(!showTestClientSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showTestClientSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID de Producción
                </label>
                <input
                  type="text"
                  value={productionClientId}
                  onChange={(e) => setProductionClientId(e.target.value)}
                  placeholder="Client ID..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret de Producción
                </label>
                <div className="relative">
                  <input
                    type={showProductionClientSecret ? 'text' : 'password'}
                    value={productionClientSecret}
                    onChange={(e) => setProductionClientSecret(e.target.value)}
                    placeholder={config?.hasProductionCredentials ? '••••••••••••••••' : 'Client Secret...'}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProductionClientSecret(!showProductionClientSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showProductionClientSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
                  <li><strong>Access Token y Public Key</strong> se usan para pagos con Checkout Pro</li>
                  <li><strong>Client ID y Client Secret</strong> se usan para OAuth y otras integraciones</li>
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
              Volver
            </button>
          </div>
        </form>
          </div>
        </div>
      </main>
    </div>
  )
}
