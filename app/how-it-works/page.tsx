'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  UserCheck,
  MessageSquare,
  Calendar,
  CheckCircle,
  Star,
  Shield,
  Clock,
  DollarSign,
  Users,
  Zap,
  ArrowRight,
  ChevronRight,
  Sparkles
} from 'lucide-react'

export default function HowItWorksPage() {
  const [activeTab, setActiveTab] = useState<'client' | 'partner'>('client')

  const clientSteps = [
    {
      icon: Search,
      title: '1. Busca el servicio',
      description: 'Explora nuestra amplia variedad de servicios o busca específicamente lo que necesitas.',
      details: 'Usa nuestra barra de búsqueda inteligente o navega por categorías. Filtra por ubicación, precio y calificaciones.',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: UserCheck,
      title: '2. Elige tu profesional',
      description: 'Revisa perfiles, calificaciones y precios de profesionales verificados.',
      details: 'Compara múltiples opciones, lee reseñas de otros clientes y verifica certificaciones.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: MessageSquare,
      title: '3. Solicita y negocia',
      description: 'Envía tu solicitud con detalles específicos y recibe propuestas personalizadas.',
      details: 'Chatea directamente con los profesionales, aclara dudas y negocia el mejor precio.',
      color: 'from-pink-500 to-pink-600'
    },
    {
      icon: Calendar,
      title: '4. Agenda y confirma',
      description: 'Selecciona fecha y hora que te convengan y confirma la reserva.',
      details: 'Recibe confirmación instantánea y recordatorios automáticos antes del servicio.',
      color: 'from-primary-500 to-primary-600'
    },
    {
      icon: CheckCircle,
      title: '5. Recibe el servicio',
      description: 'El profesional llega a tiempo y realiza el trabajo acordado.',
      details: 'Seguimiento en tiempo real, soporte 24/7 y garantía de satisfacción.',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: Star,
      title: '6. Califica y paga',
      description: 'Evalúa el servicio y realiza el pago de forma segura.',
      details: 'Múltiples métodos de pago, protección de compra y sistema de reembolso.',
      color: 'from-yellow-500 to-yellow-600'
    }
  ]

  const partnerSteps = [
    {
      icon: UserCheck,
      title: '1. Regístrate gratis',
      description: 'Crea tu perfil profesional en minutos con tus datos y certificaciones.',
      details: 'Proceso simple y rápido. Verifica tu identidad y habilidades para ganar confianza.',
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Shield,
      title: '2. Completa tu perfil',
      description: 'Agrega fotos, describe tus servicios y establece tus tarifas.',
      details: 'Destaca tu experiencia, muestra trabajos anteriores y define tu área de cobertura.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: MessageSquare,
      title: '3. Recibe solicitudes',
      description: 'Los clientes te contactan directamente según tu perfil y disponibilidad.',
      details: 'Notificaciones instantáneas, chat en tiempo real y gestión de múltiples solicitudes.',
      color: 'from-pink-500 to-pink-600'
    },
    {
      icon: Calendar,
      title: '4. Acepta trabajos',
      description: 'Revisa detalles, negocia términos y confirma los servicios que te convengan.',
      details: 'Tú decides qué trabajos aceptar, cuándo trabajar y cómo organizar tu agenda.',
      color: 'from-primary-500 to-primary-600'
    },
    {
      icon: Zap,
      title: '5. Realiza el servicio',
      description: 'Llega puntual, realiza un trabajo de calidad y supera expectativas.',
      details: 'Accede a información del cliente, ubicación y detalles del servicio en la app.',
      color: 'from-green-500 to-green-600'
    },
    {
      icon: DollarSign,
      title: '6. Recibe tu pago',
      description: 'Cobra de forma segura y rápida después de completar cada servicio.',
      details: 'Pagos garantizados, transferencias rápidas y historial detallado de ingresos.',
      color: 'from-yellow-500 to-yellow-600'
    }
  ]

  const benefits = [
    {
      icon: Shield,
      title: 'Seguridad garantizada',
      description: 'Todos los profesionales están verificados y los pagos son seguros.'
    },
    {
      icon: Clock,
      title: 'Ahorra tiempo',
      description: 'Encuentra y contrata profesionales en minutos, no en días.'
    },
    {
      icon: DollarSign,
      title: 'Mejores precios',
      description: 'Compara múltiples opciones y elige la que mejor se ajuste a tu presupuesto.'
    },
    {
      icon: Users,
      title: 'Comunidad confiable',
      description: 'Miles de usuarios satisfechos y profesionales calificados.'
    }
  ]

  const steps = activeTab === 'client' ? clientSteps : partnerSteps

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 text-white pt-24 pb-20">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold mb-8 border border-white/30">
              <Sparkles className="w-4 h-4" />
              <span>Simple, rápido y efectivo</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              ¿Cómo funciona
              <span className="block bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent">LoHaggo?</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-12 text-white/90 font-medium max-w-3xl mx-auto">
              Conectamos clientes con profesionales verificados en 6 simples pasos
            </p>
          </div>
        </div>
      </section>

      {/* Tab Selector */}
      <section className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center gap-4 py-6">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
                activeTab === 'client'
                  ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Soy Cliente
            </button>
            <button
              onClick={() => setActiveTab('partner')}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
                activeTab === 'partner'
                  ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Soy Profesional
            </button>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 border border-gray-100"
                >
                  <div className={`w-16 h-16 bg-gradient-to-r ${step.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-black text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  
                  <p className="text-gray-600 font-semibold mb-4">
                    {step.description}
                  </p>
                  
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {step.details}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              ¿Por qué elegir LoHaggo?
            </h2>
            <p className="text-xl text-gray-600 font-medium">
              La plataforma más confiable para servicios profesionales
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <div
                  key={index}
                  className="text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:shadow-xl transition-all"
                >
                  <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 font-medium">
                    {benefit.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            ¿Listo para comenzar?
          </h2>
          <p className="text-xl mb-10 text-white/90 font-medium">
            Únete a miles de usuarios que ya confían en LoHaggo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl"
            >
              Registrarme como cliente
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/register?role=partner"
              className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all border-2 border-white/30"
            >
              Ser profesional
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
