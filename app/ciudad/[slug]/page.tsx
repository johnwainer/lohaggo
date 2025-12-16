'use client'

import { use, useEffect, useState } from 'react'
import { useCity } from '@/lib/city-context'
import { useRouter } from 'next/navigation'
import { MapPin, Sparkles, Clock, Shield, Star, CheckCircle, Zap, Users, Award, TrendingUp, ArrowRight, Bell, Heart, Rocket, Gift, Calendar, Phone, Mail, MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default function CityComingSoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { cities } = useCity()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeTab, setActiveTab] = useState<'benefits' | 'services' | 'how'>('benefits')

  const city = cities.find(c => c.slug === slug)

  useEffect(() => {
    setIsAnimating(true)
  }, [])

  useEffect(() => {
    if (city && city.status === 'ACTIVE') {
      router.push('/')
    }
  }, [city, router])

  if (!city) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ciudad no encontrada</h1>
          <Link href="/" className="text-primary-600 hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setEmail('')
  }

  const benefits = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Servicio Rápido",
      description: "Conectamos con profesionales en minutos, no en días",
      color: "from-primary-500 to-red-500"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "100% Verificado",
      description: "Todos nuestros profesionales están verificados y certificados",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Calidad Garantizada",
      description: "Satisfacción garantizada o te devolvemos tu dinero",
      color: "from-yellow-500 to-primary-400"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Red de Expertos",
      description: "Miles de profesionales listos para ayudarte",
      color: "from-purple-500 to-secondary-500"
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: "Mejor Precio",
      description: "Compara propuestas y elige la que mejor se ajuste",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Siempre Mejorando",
      description: "Innovamos constantemente para ofrecerte lo mejor",
      color: "from-indigo-500 to-accent-500"
    }
  ]

  const services = [
    { name: "Plomería", icon: "🔧" },
    { name: "Electricidad", icon: "⚡" },
    { name: "Limpieza", icon: "🧹" },
    { name: "Belleza", icon: "💅" },
    { name: "Carpintería", icon: "🪚" },
    { name: "Pintura", icon: "🎨" },
    { name: "Jardinería", icon: "🌱" },
    { name: "Mudanzas", icon: "📦" },
    { name: "Masajes", icon: "💆" },
    { name: "Cerrajería", icon: "🔑" },
    { name: "Aire Acondicionado", icon: "❄️" },
    { name: "Tecnología", icon: "💻" }
  ]

  const steps = [
    {
      number: "1",
      title: "Solicita el servicio",
      description: "Describe lo que necesitas en menos de 2 minutos",
      icon: <MessageCircle className="w-8 h-8" />
    },
    {
      number: "2",
      title: "Recibe propuestas",
      description: "Profesionales verificados te envían sus ofertas",
      icon: <Users className="w-8 h-8" />
    },
    {
      number: "3",
      title: "Elige y agenda",
      description: "Compara, elige el mejor y agenda cuando quieras",
      icon: <Calendar className="w-8 h-8" />
    },
    {
      number: "4",
      title: "Disfruta el servicio",
      description: "Profesional llega a tu puerta, tú solo relájate",
      icon: <Heart className="w-8 h-8" />
    }
  ]

  const stats = [
    { value: "50K+", label: "Servicios completados" },
    { value: "10K+", label: "Profesionales activos" },
    { value: "4.9", label: "Calificación promedio" },
    { value: "98%", label: "Clientes satisfechos" }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-secondary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-accent-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-1000 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-6 py-3 rounded-full mb-6 shadow-lg animate-bounce">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-bold">¡Próximamente en tu ciudad!</span>
          </div>
          
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-6 bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 bg-clip-text text-transparent animate-gradient">
            {city.name}
          </h1>

          {city.fechaLanzamiento && (
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full mb-4 shadow-lg border-2 border-primary-200">
              <Calendar className="w-5 h-5 text-primary-600" />
              <span className="text-lg font-bold text-gray-800">
                Lanzamiento: {new Date(city.fechaLanzamiento).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          <p className="text-2xl sm:text-3xl text-gray-700 mb-4 max-w-3xl mx-auto font-bold">
            ¡La revolución de servicios está llegando! 🚀
          </p>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Estamos preparando algo increíble para ti. Pronto podrás acceder a cientos de servicios profesionales 
            con solo un clic desde {city.name}.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-white rounded-2xl p-6 text-center shadow-xl border-2 border-primary-100 hover:border-primary-300 transition-all duration-500 transform hover:scale-105 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="text-4xl font-black bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 font-semibold">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className={`bg-gradient-to-br from-white to-primary-50 rounded-3xl shadow-2xl p-8 sm:p-12 mb-16 border-2 border-primary-200 transition-all duration-1000 delay-300 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full mb-4 animate-pulse">
              <Bell className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-3">
              ¡Sé el primero en saberlo! 🎉
            </h2>
            <p className="text-lg text-gray-600">
              Regístrate ahora y obtén <span className="text-primary-600 font-bold">beneficios exclusivos</span> de lanzamiento
            </p>
          </div>

          {!subscribed ? (
            <form onSubmit={handleSubscribe} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="flex-1 px-6 py-4 rounded-xl border-2 border-primary-200 focus:border-primary-500 focus:outline-none text-lg shadow-sm"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Notificarme
                  <Rocket className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-6 bg-gradient-to-r from-primary-100 to-secondary-100 rounded-xl p-4 border-2 border-primary-200">
                <div className="flex items-start gap-3">
                  <Gift className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-primary-900 mb-1">🎁 Beneficios de Pre-Lanzamiento:</p>
                    <ul className="text-sm text-primary-800 space-y-1">
                      <li>✨ 50% de descuento en tu primer servicio</li>
                      <li>🎯 Acceso prioritario a profesionales premium</li>
                      <li>💎 Membresía VIP gratis por 3 meses</li>
                    </ul>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="max-w-md mx-auto text-center">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-8 shadow-lg">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-2xl font-black text-green-900 mb-3">
                  ¡Genial! Ya estás en la lista 🎊
                </h3>
                <p className="text-green-700 text-lg">
                  Te avisaremos cuando lancemos en <span className="font-bold">{city.name}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-16">
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setActiveTab('benefits')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'benefits'
                  ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ¿Por qué LoHaggo?
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'services'
                  ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Servicios
            </button>
            <button
              onClick={() => setActiveTab('how')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'how'
                  ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ¿Cómo funciona?
            </button>
          </div>

          {activeTab === 'benefits' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-gray-100 hover:border-primary-300 group"
                >
                  <div className={`bg-gradient-to-br ${benefit.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white transform group-hover:scale-110 group-hover:rotate-6 transition-all`}>
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-primary-100">
              <h3 className="text-3xl font-black text-center mb-8 bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                Más de 100 servicios disponibles
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-4 text-center hover:shadow-lg transition-all transform hover:scale-105 border-2 border-primary-100 hover:border-primary-300"
                  >
                    <div className="text-4xl mb-2">{service.icon}</div>
                    <div className="text-sm font-bold text-gray-700">{service.name}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-gray-500 mt-6 text-lg">
                ¡Y muchos más! 🎯
              </p>
            </div>
          )}

          {activeTab === 'how' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-xl border-2 border-primary-100 hover:border-primary-300 transition-all relative"
                >
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg">
                    {step.number}
                  </div>
                  <div className="text-primary-500 mb-4 mt-4">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`bg-gradient-to-r from-primary-500 via-secondary-500 to-red-500 rounded-3xl p-12 text-center text-white shadow-2xl transition-all duration-1000 delay-700 relative overflow-hidden ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <Rocket className="w-20 h-20 mx-auto mb-6 animate-bounce" />
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              ¿No puedes esperar? 🔥
            </h2>
            <p className="text-2xl mb-8 max-w-2xl mx-auto font-semibold">
              Explora todos los servicios que pronto estarán en {city.name}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-3 bg-white text-primary-600 px-10 py-5 rounded-2xl font-black text-xl hover:shadow-2xl transform hover:scale-105 transition-all"
            >
              Ver todos los servicios
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>

        <div className="mt-16 text-center space-y-6">
          <div className="flex justify-center gap-8 text-gray-600">
            <a href="tel:+573001234567" className="flex items-center gap-2 hover:text-primary-500 transition-colors">
              <Phone className="w-5 h-5" />
              <span className="font-semibold">+57 300 123 4567</span>
            </a>
            <a href="mailto:hola@lohaggo.com" className="flex items-center gap-2 hover:text-primary-500 transition-colors">
              <Mail className="w-5 h-5" />
              <span className="font-semibold">hola@lohaggo.com</span>
            </a>
          </div>
          <Link
            href="/"
            className="inline-block text-primary-600 hover:text-primary-700 font-bold text-lg hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  )
}
