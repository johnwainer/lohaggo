'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone, Download, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Home, Menu, Share2, Plus, ArrowLeft, Zap } from 'lucide-react'

export default function AndroidDownloadPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://')

    setIsInstalled(isStandaloneMode)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert('Para instalar la app, usa el menú de tu navegador (⋮) y selecciona "Agregar a pantalla de inicio" o "Instalar app"')
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setIsInstalled(true)
      setCanInstall(false)
    }
  }

  const faqs = [
    {
      question: '¿Por qué no veo el botón de instalación?',
      answer: 'Asegúrate de estar usando Chrome, Edge o Samsung Internet. Si ya instalaste la app anteriormente, no verás el botón. También verifica que estés accediendo desde HTTPS.'
    },
    {
      question: '¿La app ocupa mucho espacio?',
      answer: 'No, la PWA es muy ligera, generalmente menos de 5MB. Además, se actualiza automáticamente sin necesidad de descargas adicionales.'
    },
    {
      question: '¿Puedo desinstalar la app?',
      answer: 'Sí, puedes desinstalarla como cualquier otra app: mantén presionado el ícono y selecciona "Desinstalar" o ve a Configuración > Apps > LoHaggo > Desinstalar.'
    },
    {
      question: '¿Necesito conexión a internet?',
      answer: 'Sí, LoHaggo requiere conexión a internet para funcionar correctamente y mostrarte los servicios disponibles en tiempo real.'
    },
    {
      question: '¿La app es segura?',
      answer: 'Completamente. Nuestra PWA usa HTTPS y las mismas medidas de seguridad que el sitio web. Tus datos están protegidos.'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-8 font-semibold">
          <ArrowLeft className="w-5 h-5" />
          Volver al inicio
        </Link>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-3xl mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/>
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            Instala LoHaggo en Android
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Accede más rápido a todos los servicios con nuestra app optimizada para tu dispositivo Android
          </p>
        </div>

        {isInstalled ? (
          <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-8 mb-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-900 mb-2">¡App instalada correctamente!</h2>
            <p className="text-green-700 mb-6">Ya puedes usar LoHaggo desde tu pantalla de inicio</p>
            <Link href="/" className="inline-block bg-green-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-green-700 transition-all">
              Abrir LoHaggo
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-12 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">One-Click Installation</h2>
            </div>

            <button
              onClick={handleInstall}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-6 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 mb-4 flex items-center justify-center gap-3"
            >
              <Download className="w-7 h-7" />
              Install Application
            </button>

            {canInstall ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900">
                    <strong>Ready to install!</strong> Click the button above and the app will be automatically installed on your device.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <strong>Manual installation:</strong> Click the button above or use your browser menu (⋮) and select "Add to home screen".
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <strong>Compatible browsers:</strong> Chrome, Edge, Samsung Internet, Firefox, Opera
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-8 mb-12 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary-600" />
            </div>
            Instrucciones Paso a Paso
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Abre el menú de tu navegador</h3>
                <p className="text-gray-600 mb-3">Toca los tres puntos verticales <Menu className="w-4 h-4 inline" /> en la esquina superior derecha</p>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-700"><strong>Chrome:</strong> Menú → "Agregar a pantalla de inicio"</p>
                  <p className="text-sm text-gray-700 mt-2"><strong>Edge:</strong> Menú → "Aplicaciones" → "Instalar esta aplicación"</p>
                  <p className="text-sm text-gray-700 mt-2"><strong>Samsung Internet:</strong> Menú → "Agregar página a"</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Selecciona "Instalar" o "Agregar"</h3>
                <p className="text-gray-600">Confirma la instalación cuando aparezca el mensaje</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">¡Listo! Abre la app</h3>
                <p className="text-gray-600">Busca el ícono de LoHaggo en tu pantalla de inicio y ábrelo</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-3xl shadow-xl p-8 mb-12 border border-primary-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Beneficios de la App</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Acceso instantáneo</h3>
                <p className="text-gray-600 text-sm">Abre la app directamente desde tu pantalla de inicio</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Notificaciones push</h3>
                <p className="text-gray-600 text-sm">Recibe alertas sobre tus reservas y mensajes</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Experiencia optimizada</h3>
                <p className="text-gray-600 text-sm">Interfaz diseñada específicamente para móviles</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Actualizaciones automáticas</h3>
                <p className="text-gray-600 text-sm">Siempre tendrás la última versión sin descargas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 text-left">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">¿Necesitas ayuda adicional?</p>
          <Link href="/contact" className="inline-block text-primary-600 hover:text-primary-700 font-bold">
            Contáctanos →
          </Link>
        </div>
      </div>
    </div>
  )
}
