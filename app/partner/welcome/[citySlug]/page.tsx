'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  CheckCircle,
  Calendar,
  FileCheck,
  GraduationCap,
  Shield,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  Clock,
  Target
} from 'lucide-react'

interface CityData {
  id: string
  name: string
  slug: string
  status: string
  fechaLanzamiento?: string
}

export default function PartnerWelcomePage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = use(params)
  const router = useRouter()
  const { data: session, status } = useSession()
  const [city, setCity] = useState<CityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    const fetchCity = async () => {
      try {
        const res = await fetch('/api/cities')
        const cities = await res.json()
        const foundCity = cities.find((c: CityData) => c.slug === citySlug)
        
        if (foundCity) {
          setCity(foundCity)
        } else {
          router.push('/partner')
        }
      } catch (error) {
        console.error('Error fetching city:', error)
        router.push('/partner')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchCity()
    }
  }, [citySlug, router, status])

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    )
  }

  if (!city) {
    return null
  }

  const launchDate = city.fechaLanzamiento 
    ? new Date(city.fechaLanzamiento).toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'Próximamente'

  const steps = [
    {
      icon: FileCheck,
      title: 'Completa tu Perfil',
      description: 'Agrega tu información profesional, experiencia y servicios que ofreces.',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      icon: Shield,
      title: 'Verifica tu Identidad',
      description: 'Sube tu documento de identidad (cédula, pasaporte o PEP) para verificación.',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      icon: GraduationCap,
      title: 'Valida tu Educación',
      description: 'Comparte tus diplomas, certificados o cursos relacionados con tus servicios.',
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ]

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Ingresos Flexibles',
      description: 'Define tus propios horarios y tarifas'
    },
    {
      icon: Users,
      title: 'Clientes Verificados',
      description: 'Accede a una base de clientes confiables'
    },
    {
      icon: Sparkles,
      title: 'Sin Costos Iniciales',
      description: 'Regístrate gratis y empieza a trabajar'
    },
    {
      icon: Target,
      title: 'Prioridad de Lanzamiento',
      description: 'Serás de los primeros en recibir solicitudes'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full mb-6 shadow-lg">
            <CheckCircle size={40} className="text-white" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            ¡Bienvenido a <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-pink-600">Haggo</span>!
          </h1>
          
          <p className="text-xl text-gray-700 mb-2">
            Gracias por registrarte como Socio en <span className="font-bold text-orange-600">{city.name}</span>
          </p>
          
          <div className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-full shadow-md border-2 border-orange-200 mt-4">
            <Calendar className="text-orange-600" size={20} />
            <span className="text-gray-700">
              Fecha de lanzamiento: <span className="font-bold text-orange-600">{launchDate}</span>
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-100 to-pink-100 rounded-2xl p-6 md:p-8 mb-8 border-2 border-orange-200 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Clock size={24} className="text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                ¿Qué sigue ahora?
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Aunque {city.name} aún no está activa, puedes empezar a prepararte desde ahora. 
                Completa tu perfil y verifica tus documentos para estar listo cuando lancemos. 
                <span className="font-semibold text-orange-700"> ¡Los socios verificados tendrán prioridad en las primeras solicitudes!</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">
            Pasos para Completar tu Registro
          </h2>
          
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`bg-white rounded-xl p-6 border-2 ${step.borderColor} shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center shadow-md`}>
                      <step.icon size={24} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-200 text-gray-700 rounded-full text-sm font-bold">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                    </div>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 mb-8 shadow-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Beneficios de ser Socio Verificado
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 hover:border-orange-300 transition-all"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <benefit.icon size={20} className="text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-8 text-center shadow-xl">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            ¡Empieza Ahora!
          </h2>
          <p className="text-white/90 mb-6 text-lg">
            Completa tu perfil y verifica tus documentos para estar listo el día del lanzamiento
          </p>
          <button
            onClick={() => router.push('/partner')}
            className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-8 py-4 rounded-xl hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <span>Ir a mi Panel de Socio</span>
            <ArrowRight size={20} />
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 text-sm">
            ¿Tienes preguntas? <a href="/contact" className="text-orange-600 hover:text-orange-700 font-semibold underline">Contáctanos</a>
          </p>
        </div>
      </div>
    </div>
  )
}
