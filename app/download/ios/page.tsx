'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone, Download, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Share2, Plus, ArrowLeft } from 'lucide-react'

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
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-8 font-semibold">
          <ArrowLeft className="w-5 h-5" />
          Volver al inicio
        </Link>

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
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Installation on Safari</h2>
            </div>

            {canInstall ? (
              <>
                <button
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-gray-700 to-gray-900 text-white py-6 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 mb-4"
                >
                  <Download className="w-6 h-6 inline-block mr-2" />
                  Install App Now
                </button>
                <p className="text-center text-sm text-gray-600 mb-6">
                  Click the button to install the app on your device
                </p>
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <strong>Important:</strong> You must use Safari to install the app. If you are on another browser, open this page in Safari first. Follow the instructions below.
                  </div>
                </div>
              </div>
            )}
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
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Abre Safari</h3>
                <p className="text-gray-600 mb-3">Si estás en otro navegador, copia esta URL y ábrela en Safari</p>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <code className="text-sm text-gray-700 break-all">https://lohaggo.com</code>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Toca el botón de compartir</h3>
                <p className="text-gray-600 mb-3">Es el ícono de un cuadrado con una flecha hacia arriba <Share2 className="w-4 h-4 inline" /> en la parte inferior de Safari</p>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>Ubicación:</strong> En iPhone, está en la parte inferior central. En iPad, está en la parte superior derecha.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Selecciona "Agregar a pantalla de inicio"</h3>
                <p className="text-gray-600 mb-3">Desplázate hacia abajo en el menú y busca esta opción con el ícono <Plus className="w-4 h-4 inline" /></p>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">
                    Si no ves esta opción, asegúrate de estar en Safari y no en modo privado
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Confirma el nombre y toca "Agregar"</h3>
                <p className="text-gray-600">Puedes cambiar el nombre si lo deseas, luego toca "Agregar" en la esquina superior derecha</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                5
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">¡Listo! Abre la app</h3>
                <p className="text-gray-600">Busca el ícono de LoHaggo en tu pantalla de inicio y ábrelo como cualquier otra app</p>
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
                <p className="text-gray-600 text-sm">Interfaz diseñada específicamente para iOS</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Actualizaciones automáticas</h3>
                <p className="text-gray-600 text-sm">Siempre tendrás la última versión sin descargas</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Sin App Store</h3>
                <p className="text-gray-600 text-sm">No necesitas descargar desde la App Store</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Menos espacio</h3>
                <p className="text-gray-600 text-sm">Ocupa mucho menos espacio que una app nativa</p>
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
