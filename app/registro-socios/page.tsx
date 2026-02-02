'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserPlus, CheckCircle, TrendingUp, Shield, DollarSign, Clock, Users, ArrowRight } from 'lucide-react'

export default function RegistroSociosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const handleRegistroSocio = async () => {
    if (session) {
      await signOut({ redirect: false })
    }
    window.location.href = 'https://forms.gle/tu-link-de-registro-de-socios'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mb-6">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            ¡Estamos Registrando Socios!
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            En este momento estamos en proceso de registro de socios para brindarte el mejor servicio. 
            Únete a nuestra red de profesionales verificados y comienza a generar ingresos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Genera Ingresos</h3>
            <p className="text-gray-600">
              Aumenta tus ingresos ofreciendo tus servicios profesionales a miles de clientes potenciales.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-secondary-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Verificación Segura</h3>
            <p className="text-gray-600">
              Proceso de verificación completo para garantizar la confianza de nuestros clientes.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Pagos Seguros</h3>
            <p className="text-gray-600">
              Sistema de pagos integrado y seguro. Recibe tus pagos de forma rápida y confiable.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Flexibilidad Total</h3>
            <p className="text-gray-600">
              Tú decides cuándo y dónde trabajar. Administra tu tiempo y tus servicios.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Red de Clientes</h3>
            <p className="text-gray-600">
              Accede a una amplia base de clientes que buscan servicios profesionales de calidad.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Soporte 24/7</h3>
            <p className="text-gray-600">
              Equipo de soporte disponible para ayudarte en todo momento con cualquier consulta.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl border border-gray-100 text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-4">
            ¿Listo para Unirte?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Completa el formulario de registro y nuestro equipo se pondrá en contacto contigo 
            para iniciar el proceso de verificación y activación de tu cuenta.
          </p>
          <button
            onClick={handleRegistroSocio}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-primary-700 hover:to-secondary-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Registrarme como Socio
            <ArrowRight className="w-5 h-5" />
          </button>
          {session && (
            <p className="text-sm text-gray-500 mt-4">
              Serás deslogueado automáticamente para completar el registro
            </p>
          )}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
