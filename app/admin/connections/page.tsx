'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Mail, Phone, CreditCard, Bell, CheckCircle2, XCircle, AlertCircle,
  ArrowRight, RefreshCw, Loader2, Settings, Zap,
} from 'lucide-react'

type ProviderStatus = 'active' | 'inactive' | 'unknown'

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  status: ProviderStatus
  details: string[]
  href: string
  category: string
}

interface ProvidersData {
  twilio: {
    active: boolean
    accountSid: string
    smsFrom: string
    whatsappFrom: string
    hasAuthToken: boolean
  }
  sendgrid: {
    active: boolean
    fromEmail: string
    hasApiKey: boolean
  }
  push: {
    configured: boolean
    hasVapidPublicKey: boolean
    hasVapidPrivateKey: boolean
  }
}

interface PaymentData {
  environment: 'TEST' | 'PRODUCTION'
  hasTestCredentials: boolean
  hasProductionCredentials: boolean
  activeEnvironmentReady: boolean
  validation?: {
    test?: { ok: boolean } | null
    production?: { ok: boolean } | null
  }
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle2 size={12} /> Activo
      </span>
    )
  }
  if (status === 'inactive') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <XCircle size={12} /> Sin configurar
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <AlertCircle size={12} /> Desconocido
    </span>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <div className={`bg-white rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all ${
      integration.status === 'active'
        ? 'border-green-100 hover:border-green-200'
        : integration.status === 'inactive'
        ? 'border-red-100 hover:border-red-200'
        : 'border-gray-100 hover:border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${
            integration.status === 'active' ? 'bg-green-50' : 'bg-gray-50'
          }`}>
            {integration.icon}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{integration.category}</p>
            <h3 className="text-base font-bold text-gray-900">{integration.name}</h3>
          </div>
        </div>
        <StatusBadge status={integration.status} />
      </div>

      <p className="text-sm text-gray-500">{integration.description}</p>

      {integration.details.length > 0 && (
        <ul className="space-y-1">
          {integration.details.map((detail, i) => (
            <li key={i} className="text-xs text-gray-600 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
              {detail}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-2">
        <Link
          href={integration.href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          <Settings size={14} />
          Configurar
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

export default function ConnectionsPage() {
  const [providers, setProviders] = useState<ProvidersData | null>(null)
  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, payRes] = await Promise.all([
        fetch('/api/admin/messaging/providers'),
        fetch('/api/admin/payment-config'),
      ])
      if (!pRes.ok || !payRes.ok) throw new Error('Error cargando datos')
      const pData = await pRes.json()
      const payData = await payRes.json()
      setProviders(pData.providers)
      setPayment(payData)
    } catch {
      setError('No se pudieron cargar las integraciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const integrations: Integration[] = providers && payment ? [
    {
      id: 'sendgrid',
      name: 'SendGrid',
      category: 'Email',
      description: 'Envío de correos transaccionales: recuperación de contraseña, confirmaciones, notificaciones.',
      icon: <Mail size={20} className={providers.sendgrid.active ? 'text-green-600' : 'text-gray-400'} />,
      status: providers.sendgrid.active && providers.sendgrid.hasApiKey ? 'active' : 'inactive',
      details: [
        `Remitente: ${providers.sendgrid.fromEmail || 'No configurado'}`,
        providers.sendgrid.hasApiKey ? 'API Key: configurada' : 'API Key: faltante',
      ],
      href: '/admin/messaging',
    },
    {
      id: 'twilio-sms',
      name: 'Twilio SMS',
      category: 'SMS',
      description: 'Mensajes de texto para alertas, verificaciones y notificaciones urgentes.',
      icon: <Phone size={20} className={providers.twilio.active ? 'text-green-600' : 'text-gray-400'} />,
      status: providers.twilio.active && providers.twilio.hasAuthToken ? 'active' : 'inactive',
      details: [
        `Número: ${providers.twilio.smsFrom || 'No configurado'}`,
        `Account SID: ${providers.twilio.accountSid ? providers.twilio.accountSid.slice(0, 8) + '…' : 'No configurado'}`,
      ],
      href: '/admin/messaging',
    },
    {
      id: 'twilio-wa',
      name: 'Twilio WhatsApp',
      category: 'WhatsApp',
      description: 'Mensajería masiva y transaccional por WhatsApp Business con plantillas aprobadas.',
      icon: <Zap size={20} className={providers.twilio.active && providers.twilio.whatsappFrom ? 'text-green-600' : 'text-gray-400'} />,
      status: providers.twilio.active && providers.twilio.whatsappFrom ? 'active' : 'inactive',
      details: [
        `Número WA: ${providers.twilio.whatsappFrom || 'No configurado'}`,
        providers.twilio.hasAuthToken ? 'Credenciales: configuradas' : 'Credenciales: faltantes',
      ],
      href: '/admin/messaging',
    },
    {
      id: 'mercadopago',
      name: 'MercadoPago',
      category: 'Pagos',
      description: 'Procesamiento de pagos con tarjeta y PSE en Colombia. Ambiente activo configurable.',
      icon: <CreditCard size={20} className={payment.activeEnvironmentReady ? 'text-green-600' : 'text-gray-400'} />,
      status: payment.activeEnvironmentReady
        ? 'active'
        : (payment.hasTestCredentials || payment.hasProductionCredentials) ? 'inactive' : 'inactive',
      details: [
        `Ambiente: ${payment.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}`,
        payment.hasProductionCredentials ? 'Credenciales producción: ✓' : 'Credenciales producción: pendientes',
        payment.hasTestCredentials ? 'Credenciales prueba: ✓' : 'Credenciales prueba: pendientes',
      ],
      href: '/admin/payment-config',
    },
    {
      id: 'push',
      name: 'Notificaciones Push',
      category: 'Push Web',
      description: 'Notificaciones en tiempo real al navegador para usuarios con la app instalada (PWA).',
      icon: <Bell size={20} className={providers.push.configured ? 'text-green-600' : 'text-gray-400'} />,
      status: providers.push.configured ? 'active' : 'inactive',
      details: [
        providers.push.hasVapidPublicKey ? 'VAPID Public Key: ✓' : 'VAPID Public Key: faltante',
        providers.push.hasVapidPrivateKey ? 'VAPID Private Key: ✓' : 'VAPID Private Key: faltante',
        'Configurable en variables de entorno (Vercel)',
      ],
      href: '/admin/pwa-adoption',
    },
  ] : []

  const activeCount = integrations.filter(i => i.status === 'active').length
  const totalCount = integrations.length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conexiones</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Servicios externos conectados a la plataforma. Gestiona credenciales y verifica el estado de cada integración.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Actualizar
          </button>
        </div>

        {/* Summary bar */}
        {!loading && !error && (
          <div className="mt-5 flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className={`w-2 h-2 rounded-full ${activeCount === totalCount ? 'bg-green-500' : activeCount > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-gray-700">
              {activeCount} de {totalCount} integraciones activas
            </span>
            {activeCount < totalCount && (
              <span className="text-sm text-gray-500">
                — {totalCount - activeCount} requieren configuración
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={28} className="animate-spin mr-3" />
          <span className="text-sm font-medium">Cargando integraciones…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {integrations.map(integration => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      )}

      {/* Footer note */}
      {!loading && !error && (
        <p className="mt-8 text-xs text-gray-400 text-center">
          Las credenciales se almacenan cifradas en la base de datos (AES-256-GCM). Las claves VAPID se configuran como variables de entorno en Vercel.
        </p>
      )}
    </div>
  )
}
