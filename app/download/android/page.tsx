'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone, Download, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Menu, ArrowLeft, Zap, Sparkles, Rocket, Shield } from 'lucide-react'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'
import { PWA_EVENTS } from '@/lib/pwa/events'

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
    trackPwaEvent({ eventName: PWA_EVENTS.INSTALL_CLICKED, source: 'download_android' })
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMGMwNTEiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00em0wIDI0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDQtMS43OSA0LTQgNC00LTEuNzktNC00ek0xMiAxNmMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHptMCAyNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 relative z-10">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-400 via-green-500 to-green-600 rounded-3xl mb-6 shadow-2xl transform hover:scale-110 transition-transform duration-300 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-300 to-green-500 rounded-3xl blur-xl opacity-50 animate-pulse"></div>
            <svg className="w-14 h-14 text-white relative z-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/>
            </svg>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            LoHaggo para Android
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 max-w-2xl mx-auto font-medium">
            Instala nuestra app en <span className="text-green-600 font-bold">1 clic</span> y accede más rápido a todos los servicios
          </p>
        </div>

        {isInstalled ? (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-3xl p-10 mb-12 text-center shadow-2xl transform hover:scale-105 transition-transform">
            <div className="relative inline-block mb-4">
              <CheckCircle2 className="w-20 h-20 text-green-600 animate-bounce" />
              <Sparkles className="w-8 h-8 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-green-900 mb-3">¡App instalada correctamente!</h2>
            <p className="text-green-700 text-lg mb-8">Ya puedes usar LoHaggo desde tu pantalla de inicio</p>
            <Link href="/" className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500 to-green-600 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105">
              <Rocket className="w-6 h-6" />
              Abrir LoHaggo
            </Link>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 mb-12 border-2 border-green-100 transform hover:shadow-3xl transition-all">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900">Instalación con 1 Clic</h2>
                <p className="text-gray-600 text-sm">Rápido, fácil y seguro</p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              className="w-full bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 text-white py-7 rounded-2xl font-black text-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 mb-6 flex items-center justify-center gap-4 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Download className="w-8 h-8 relative z-10 animate-bounce" />
              <span className="relative z-10">Instalar Aplicación</span>
            </button>

            {canInstall ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-6 mb-6 shadow-lg">
                <div className="flex gap-4">
                  <CheckCircle2 className="w-7 h-7 text-green-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h3 className="font-black text-green-900 text-lg mb-2">¡Listo para instalar!</h3>
                    <p className="text-green-800">Haz clic en el botón de arriba y la app se instalará automáticamente en tu dispositivo.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 mb-6 shadow-lg">
                <div className="flex gap-4">
                  <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-black text-amber-900 text-lg mb-2">Instalación manual</h3>
                    <p className="text-amber-800">Haz clic en el botón de arriba o usa el menú del navegador (⋮) y selecciona "Agregar a pantalla de inicio".</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-6 shadow-lg">
              <div className="flex gap-4">
                <Shield className="w-7 h-7 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-blue-900 text-lg mb-2">Navegadores compatibles</h3>
                  <p className="text-blue-800">Chrome, Edge, Samsung Internet, Firefox, Opera</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 mb-12 border-2 border-gray-100">
          <h2 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            Instrucciones Paso a Paso
          </h2>

          <div className="space-y-8">
            <div className="flex gap-5 group hover:bg-green-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Abre el menú de tu navegador</h3>
                <p className="text-gray-700 mb-4 text-lg">Toca los tres puntos verticales <Menu className="w-5 h-5 inline" /> en la esquina superior derecha</p>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border-2 border-gray-200 shadow-inner">
                  <p className="text-gray-800 font-semibold mb-2"><strong className="text-green-600">Chrome:</strong> Menú → "Agregar a pantalla de inicio"</p>
                  <p className="text-gray-800 font-semibold mb-2"><strong className="text-blue-600">Edge:</strong> Menú → "Aplicaciones" → "Instalar esta aplicación"</p>
                  <p className="text-gray-800 font-semibold"><strong className="text-purple-600">Samsung Internet:</strong> Menú → "Agregar página a"</p>
                </div>
              </div>
            </div>

            <div className="flex gap-5 group hover:bg-green-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Selecciona "Instalar" o "Agregar"</h3>
                <p className="text-gray-700 text-lg">Confirma la instalación cuando aparezca el mensaje</p>
              </div>
            </div>

            <div className="flex gap-5 group hover:bg-green-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">¡Listo! Abre la app</h3>
                <p className="text-gray-700 text-lg">Encuentra el ícono de LoHaggo en tu pantalla de inicio y ábrelo</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 rounded-3xl shadow-2xl p-8 md:p-10 mb-12 border-2 border-green-200">
          <h2 className="text-3xl font-black text-gray-900 mb-8 text-center">Beneficios de la App</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Acceso instantáneo</h3>
                <p className="text-gray-700">Abre la app directamente desde tu pantalla de inicio</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Notificaciones push</h3>
                <p className="text-gray-700">Recibe alertas sobre tus reservas y mensajes</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Experiencia optimizada</h3>
                <p className="text-gray-700">Interfaz diseñada específicamente para dispositivos móviles</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Actualizaciones automáticas</h3>
                <p className="text-gray-700">Siempre tendrás la última versión sin descargas manuales</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 border-2 border-gray-100">
          <h2 className="text-3xl font-black text-gray-900 mb-8">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-green-300 transition-all shadow-lg">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 hover:bg-green-50 transition-colors"
                >
                  <span className="font-bold text-gray-900 text-left text-lg">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6 text-gray-700 text-lg bg-green-50/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
