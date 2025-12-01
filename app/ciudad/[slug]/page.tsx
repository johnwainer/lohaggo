'use client'

import { use, useEffect, useState } from 'react'
import { useCity } from '@/lib/city-context'
import { useRouter } from 'next/navigation'
import { MapPin, Sparkles, Clock, Shield, Star, CheckCircle, Zap, Users, Award, TrendingUp, ArrowRight, Bell } from 'lucide-react'
import Link from 'next/link'

export default function CityComingSoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { cities } = useCity()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

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
          <Link href="/" className="text-[#FF2D55] hover:underline">
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
      description: "Conectamos con profesionales en minutos, no en días"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "100% Verificado",
      description: "Todos nuestros profesionales están verificados y certificados"
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Calidad Garantizada",
      description: "Satisfacción garantizada o te devolvemos tu dinero"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Red de Expertos",
      description: "Miles de profesionales listos para ayudarte"
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: "Mejor Precio",
      description: "Compara propuestas y elige la que mejor se ajuste"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Siempre Mejorando",
      description: "Innovamos constantemente para ofrecerte lo mejor"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-1000 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-100 to-pink-100 px-6 py-3 rounded-full mb-6 animate-pulse">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">Próximamente</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-[#FF2D55] via-[#FF3D00] to-[#FF6900] bg-clip-text text-transparent">
            {city.name}
          </h1>
          
          <p className="text-xl sm:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto">
            ¡Estamos trabajando para llegar a tu ciudad!
          </p>
          
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Pronto podrás disfrutar de todos los servicios de Lohaggo en {city.name}. 
            Sé el primero en enterarte cuando lancemos.
          </p>
        </div>

        <div className={`bg-white rounded-3xl shadow-2xl p-8 sm:p-12 mb-16 border border-gray-100 transition-all duration-1000 delay-300 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <Bell className="w-12 h-12 text-[#FF2D55] mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Notifícame cuando lancemos
            </h2>
            <p className="text-gray-600">
              Regístrate y recibe beneficios exclusivos de lanzamiento
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
                  className="flex-1 px-6 py-4 rounded-xl border-2 border-gray-200 focus:border-[#FF2D55] focus:outline-none text-lg"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Notificarme
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4 text-center">
                🎁 Los primeros 100 registrados recibirán un descuento especial
              </p>
            </form>
          ) : (
            <div className="max-w-md mx-auto text-center">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  ¡Listo! Te avisaremos
                </h3>
                <p className="text-green-700">
                  Recibirás un email cuando lancemos en {city.name}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={`mb-16 transition-all duration-1000 delay-500 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            ¿Por qué Lohaggo?
          </h2>
          <p className="text-center text-gray-600 mb-12 text-lg">
            La plataforma líder en servicios profesionales a domicilio
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
                style={{
                  animation: isAnimating ? `fadeInUp 0.6s ease-out ${0.6 + index * 0.1}s both` : 'none'
                }}
              >
                <div className="bg-gradient-to-br from-[#FF2D55]/10 to-[#FF6900]/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-[#FF2D55]">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className={`bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-3xl p-12 text-center text-white shadow-2xl transition-all duration-1000 delay-700 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <Clock className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Mientras tanto...
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
            Explora todos los servicios que estarán disponibles en {city.name}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-white text-[#FF2D55] px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            Ver servicios disponibles
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-500 mb-4">¿Tienes preguntas?</p>
          <Link
            href="/"
            className="text-[#FF2D55] hover:underline font-semibold"
          >
            Volver al inicio
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
