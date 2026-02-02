'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCity } from '@/lib/city-context'
import { UserPlus, CheckCircle, TrendingUp, Shield, DollarSign, Clock, Users, ArrowRight, MapPin, Sparkles, Star, Award, Zap } from 'lucide-react'

export default function RegistroSociosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedCity, getCityBySlug } = useCity()
  const [isLoading, setIsLoading] = useState(false)

  const currentCity = getCityBySlug(selectedCity)
  const cityName = currentCity?.name || 'tu ciudad'

  const handleRegistroSocio = async () => {
    setIsLoading(true)
    if (session) {
      await signOut({ redirect: false })
    }
    window.location.href = 'https://forms.gle/tu-link-de-registro-de-socios'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-secondary-500 to-accent-500 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full mb-6 border border-white/30">
            <MapPin className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">{cityName}</span>
          </div>
          
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-md rounded-full mb-8 border-4 border-white/30">
            <UserPlus className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            ¡Estamos Registrando
            <span className="block bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent">
              Socios en {cityName}!
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-medium leading-relaxed">
            Únete a nuestra red de profesionales verificados en {cityName}. 
            Estamos construyendo la mejor plataforma de servicios y queremos que seas parte de ella.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-12 mb-12 border border-white/20">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Sparkles className="w-8 h-8 text-yellow-300" />
            <h2 className="text-3xl md:text-4xl font-black text-white">
              ¿Por qué unirte a Haggo?
            </h2>
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 hover:-rotate-1">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Genera Más Ingresos</h3>
              <p className="text-gray-600 leading-relaxed">
                Accede a miles de clientes potenciales en {cityName} y aumenta tus ingresos hasta un 300%.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
              <div className="w-14 h-14 bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Verificación Segura</h3>
              <p className="text-gray-600 leading-relaxed">
                Proceso de verificación completo que genera confianza y te destaca como profesional certificado.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 hover:rotate-1">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Pagos Inmediatos</h3>
              <p className="text-gray-600 leading-relaxed">
                Recibe tus pagos de forma rápida y segura. Sin complicaciones, sin esperas.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 hover:-rotate-1">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Flexibilidad Total</h3>
              <p className="text-gray-600 leading-relaxed">
                Tú decides cuándo, dónde y cómo trabajar. Administra tu tiempo a tu manera.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Red de Clientes</h3>
              <p className="text-gray-600 leading-relaxed">
                Conecta con clientes verificados que buscan servicios de calidad en {cityName}.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 hover:rotate-1">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Award className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Soporte Dedicado</h3>
              <p className="text-gray-600 leading-relaxed">
                Equipo de soporte 24/7 para ayudarte en todo momento. Nunca estarás solo.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-16 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-full -mr-32 -mt-32 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-accent-100 to-primary-100 rounded-full -ml-32 -mb-32 opacity-50"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
              <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
              <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
              ¿Listo para Transformar tu Negocio?
            </h2>
            
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Completa el formulario de registro y nuestro equipo se pondrá en contacto contigo 
              en menos de 24 horas para iniciar tu proceso de verificación.
            </p>
            
            <button
              onClick={handleRegistroSocio}
              disabled={isLoading}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-primary-600 via-secondary-600 to-accent-600 text-white px-10 py-5 rounded-2xl font-black text-xl hover:from-primary-700 hover:via-secondary-700 hover:to-accent-700 transition-all shadow-2xl hover:shadow-3xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6" />
                  Registrarme como Socio Ahora
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
            
            {session && (
              <p className="text-sm text-gray-500 mt-6 font-medium">
                🔒 Serás deslogueado automáticamente para completar el registro de forma segura
              </p>
            )}
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 text-white hover:text-white/80 font-bold text-lg transition-all hover:gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/20 hover:bg-white/20"
          >
            <ArrowRight className="w-5 h-5 rotate-180" />
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
