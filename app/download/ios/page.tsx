'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone, Download, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Share2, Plus, ArrowLeft, Sparkles, Rocket, Shield, Apple } from 'lucide-react'

export default function IOSDownloadPage() {
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
      alert('Para instalar en iOS, sigue las instrucciones a continuación usando el botón de compartir de Safari')
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
      question: '¿Por qué solo funciona en Safari?',
      answer: 'Apple solo permite instalar PWAs desde Safari. Si estás usando Chrome u otro navegador en iOS, primero abre esta página en Safari.'
    },
    {
      question: '¿No veo el botón "Agregar a pantalla de inicio"?',
      answer: 'Asegúrate de estar usando Safari y de tocar el botón de compartir (el cuadrado con flecha hacia arriba). Desplázate hacia abajo en el menú para encontrar la opción.'
    },
    {
      question: '¿La app ocupa mucho espacio?',
      answer: 'No, la PWA es muy ligera, generalmente menos de 5MB. Además, se actualiza automáticamente sin necesidad de descargas adicionales desde la App Store.'
    },
    {
      question: '¿Puedo desinstalar la app?',
      answer: 'Sí, mantén presionado el ícono de LoHaggo en tu pantalla de inicio y selecciona "Eliminar app" o "Quitar de pantalla de inicio".'
    },
    {
      question: '¿Necesito conexión a internet?',
      answer: 'Sí, LoHaggo requiere conexión a internet para funcionar correctamente y mostrarte los servicios disponibles en tiempo real.'
    },
    {
      question: '¿La app es segura?',
      answer: 'Completamente. Nuestra PWA usa HTTPS y las mismas medidas de seguridad que el sitio web. Tus datos están protegidos con los estándares de Apple.'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-900 rounded-3xl mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            Instala LoHaggo en iOS
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Accede más rápido a todos los servicios con nuestra app optimizada para tu iPhone o iPad
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
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 mb-12 border-2 border-gray-200 transform hover:shadow-3xl transition-all">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
                <Apple className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900">Instalación en Safari</h2>
                <p className="text-gray-600 text-sm">Solo disponible en Safari</p>
              </div>
            </div>

            {canInstall ? (
              <>
                <button
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 text-white py-7 rounded-2xl font-black text-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 mb-4 flex items-center justify-center gap-4 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Download className="w-8 h-8 relative z-10 animate-bounce" />
                  <span className="relative z-10">Instalar Aplicación</span>
                </button>
                <p className="text-center text-gray-600 mb-6 text-lg">
                  Haz clic en el botón para instalar la app en tu dispositivo
                </p>
              </>
            ) : (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 mb-6 shadow-lg">
                <div className="flex gap-4">
                  <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-black text-amber-900 text-lg mb-2">Importante</h3>
                    <p className="text-amber-800">Debes usar Safari para instalar la app. Si estás en otro navegador, abre esta página en Safari primero. Sigue las instrucciones a continuación.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 mb-12 border-2 border-gray-100">
          <h2 className="text-3xl font-black text-gray-900 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            Instrucciones Paso a Paso
          </h2>

          <div className="space-y-8">
            <div className="flex gap-5 group hover:bg-blue-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Abre Safari</h3>
                <p className="text-gray-700 mb-4 text-lg">Si estás en otro navegador, copia esta URL y ábrela en Safari</p>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border-2 border-gray-200 shadow-inner">
                  <code className="text-gray-800 font-semibold break-all">https://lohaggo.com</code>
                </div>
              </div>
            </div>

            <div className="flex gap-5 group hover:bg-blue-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Toca el botón de compartir</h3>
                <p className="text-gray-700 mb-4 text-lg">Es el ícono de un cuadrado con una flecha hacia arriba <Share2 className="w-5 h-5 inline" /> en la parte inferior de Safari</p>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-200 shadow-inner">
                  <p className="text-blue-900 font-semibold">
                    <strong>Ubicación:</strong> En iPhone, está en la parte inferior central. En iPad, está en la parte superior derecha.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-5 group hover:bg-blue-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Selecciona "Agregar a pantalla de inicio"</h3>
                <p className="text-gray-700 mb-4 text-lg">Desplázate hacia abajo en el menú y busca esta opción con el ícono <Plus className="w-5 h-5 inline" /></p>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border-2 border-gray-200 shadow-inner">
                  <p className="text-gray-800 font-semibold">
                    Si no ves esta opción, asegúrate de estar en Safari y no en modo privado
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-5 group hover:bg-blue-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Confirma el nombre y toca "Agregar"</h3>
                <p className="text-gray-700 text-lg">Puedes cambiar el nombre si lo deseas, luego toca "Agregar" en la esquina superior derecha</p>
              </div>
            </div>

            <div className="flex gap-5 group hover:bg-blue-50 p-5 rounded-2xl transition-all">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:scale-110 transition-transform">
                5
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 mb-3 text-xl">Ready! Open the app</h3>
                <p className="text-gray-700 text-lg">Find the LoHaggo icon on your home screen and open it like any other app</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-100 via-slate-100 to-zinc-100 rounded-3xl shadow-2xl p-8 md:p-10 mb-12 border-2 border-gray-200">
          <h2 className="text-3xl font-black text-gray-900 mb-8 text-center">App Benefits</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Instant Access</h3>
                <p className="text-gray-700">Open the app directly from your home screen</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Push Notifications</h3>
                <p className="text-gray-700">Receive alerts about your bookings and messages</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Optimized Experience</h3>
                <p className="text-gray-700">Interface designed specifically for iOS devices</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Automatic Updates</h3>
                <p className="text-gray-700">Always have the latest version without manual downloads</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">No App Store Required</h3>
                <p className="text-gray-700">No need to download from the App Store</p>
              </div>
            </div>
            <div className="flex gap-4 bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-black text-gray-900 mb-2 text-lg">Minimal Storage</h3>
                <p className="text-gray-700">Takes up much less space than a native app</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 border-2 border-gray-100">
          <h2 className="text-3xl font-black text-gray-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-blue-300 transition-all shadow-lg">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 hover:bg-blue-50 transition-colors"
                >
                  <span className="font-bold text-gray-900 text-left text-lg">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6 text-gray-700 text-lg bg-blue-50/50">
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
