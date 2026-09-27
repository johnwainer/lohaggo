'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import { useCity } from '@/lib/city-context'
import { useRouter } from 'next/navigation'
import { Sparkles, Shield, Star, Zap, Users, Award, TrendingUp, ArrowRight, Bell, Heart, Rocket, Gift, Calendar, Mail, MessageCircle, CheckCircle2, Loader2 } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import Link from 'next/link'
import { useTrust } from '@/lib/public/useTrust'
import { fmtCount } from '@/lib/public/claims'
import { guarantee, verificationLong, verificationShort } from '@/lib/public/copy'

export default function CityComingSoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { cities } = useCity()
  const trust = useTrust()
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeTab, setActiveTab] = useState<'benefits' | 'services' | 'how'>('benefits')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'client' | 'partner'>('client')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [formState, setFormState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!consent) {
      setFormState('error')
      setFormError('Para avisarte necesitamos tu autorización.')
      return
    }
    setFormState('sending')
    setFormError(null)
    try {
      const res = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citySlug: city.slug, email, name: name || undefined, role, consent, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pudimos guardar tu registro. Intenta de nuevo.')
      setFormState('done')
    } catch (err: any) {
      setFormState('error')
      setFormError(err.message || 'No pudimos guardar tu registro. Intenta de nuevo.')
    }
  }

  const notifyText = `Hola, quiero que me avisen cuando LoHaggo llegue a ${city.name}.`
  const notifyHref = trust.whatsappPhone
    ? `https://wa.me/${trust.whatsappPhone}?text=${encodeURIComponent(notifyText)}`
    : `mailto:hola@lohaggo.com?subject=${encodeURIComponent(`Avísenme cuando lleguen a ${city.name}`)}&body=${encodeURIComponent(notifyText)}`
  const guaranteeText = guarantee(trust)

  const benefits = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Solicita en línea",
      description: "Describe lo que necesitas y recibe propuestas de profesionales",
      color: "from-primary-500 to-red-500"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: verificationShort(trust),
      description: verificationLong(trust),
      color: "from-blue-500 to-cyan-500"
    },
    ...(guaranteeText ? [{
      icon: <Star className="w-6 h-6" />,
      title: "Garantía de servicio",
      description: guaranteeText,
      color: "from-yellow-500 to-primary-400"
    }] : []),
    {
      icon: <Users className="w-6 h-6" />,
      title: "Red de Expertos",
      description: trust.stats.verifiedPartners !== null
        ? `${fmtCount(trust.stats.verifiedPartners)} profesionales verificados en LoHaggo`
        : "Profesionales verificados de distintos oficios",
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
    { name: "Plomería", slug: "plomeria", icon: "🔧" },
    { name: "Electricidad", slug: "electricidad", icon: "⚡" },
    { name: "Limpieza", slug: "limpieza-hogar", icon: "🧹" },
    { name: "Belleza", slug: "manicure-pedicure", icon: "💅" },
    { name: "Carpintería", slug: "carpinteria", icon: "🪚" },
    { name: "Pintura", slug: "pintura", icon: "🎨" },
    { name: "Jardinería", slug: "jardineria", icon: "🌱" },
    { name: "Mudanzas", slug: "mudanzas", icon: "📦" },
    { name: "Masajes", slug: "masajes", icon: "💆" },
    { name: "Cerrajería", slug: "cerrajeria", icon: "🔑" },
    { name: "Aire Acondicionado", slug: "reparacion-aires", icon: "❄️" },
    { name: "Tecnología", slug: "soporte-tecnico", icon: "💻" }
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

  // Real numbers only, each above its minimum; the block disappears when none qualifies
  const stats = [
    trust.stats.completedServices !== null && { value: fmtCount(trust.stats.completedServices), label: "Servicios completados" },
    trust.stats.verifiedPartners !== null && { value: fmtCount(trust.stats.verifiedPartners), label: "Profesionales verificados" },
    trust.stats.rating !== null && { value: trust.stats.rating.value.toFixed(1), label: `Calificación promedio (${fmtCount(trust.stats.rating.reviews)} reseñas)` },
  ].filter((x): x is { value: string; label: string } => Boolean(x))

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

          {city.launchDate && (
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full mb-4 shadow-lg border-2 border-primary-200">
              <Calendar className="w-5 h-5 text-primary-600" />
              <span className="text-lg font-bold text-gray-800">
                Lanzamiento: {new Date(city.launchDate).toLocaleDateString('es-ES', {
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
            Estamos preparando algo increíble para ti. Pronto podrás contratar servicios profesionales
            con solo un clic desde {city.name}.
          </p>
        </div>

        {stats.length > 0 && <div className={`grid grid-cols-2 ${stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-6 mb-16`}>
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
        </div>}

        <div className={`bg-gradient-to-br from-white to-primary-50 rounded-3xl shadow-2xl p-8 sm:p-12 mb-16 border-2 border-primary-200 transition-all duration-1000 delay-300 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full mb-4 animate-pulse">
              <Bell className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-3">
              ¡Sé el primero en saberlo! 🎉
            </h2>
            <p className="text-lg text-gray-600">
              Déjanos tu correo y te avisamos cuando lleguemos a {city.name}
            </p>
          </div>

          <div className="max-w-md mx-auto">
            {formState === 'done' ? (
              <div className="rounded-3xl bg-white border-2 border-green-200 p-6 text-center" role="status">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-bold text-gray-900">¡Listo! Te avisaremos</p>
                <p className="text-sm text-gray-600 mt-1">
                  Te escribiremos a {email.trim().toLowerCase()} cuando LoHaggo llegue a {city.name}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-2 rounded-full bg-white p-1 border-2 border-primary-100" role="radiogroup" aria-label="Quién eres">
                  {([
                    ['client', 'Soy cliente'],
                    ['partner', 'Quiero ser socio'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={role === value}
                      onClick={() => setRole(value)}
                      className={`rounded-full px-3 py-2.5 text-sm font-bold transition-all ${
                        role === value
                          ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="waitlist-email" className="block text-sm font-semibold text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-primary-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="waitlist-name" className="block text-sm font-semibold text-gray-700 mb-1">
                    Nombre <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-primary-400 focus:outline-none"
                  />
                </div>

                <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="waitlist-website">Sitio web</label>
                  <input
                    id="waitlist-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    Acepto que LoHaggo me contacte sobre el lanzamiento según la{' '}
                    <Link href="/privacy" className="font-semibold text-primary-600 underline" target="_blank">
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>

                {formState === 'error' && formError && (
                  <p className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={formState === 'sending' || !email.trim() || !consent}
                  className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-full font-bold hover:shadow-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {formState === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      Avísame
                      <Bell className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}

            <a
              href={notifyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full border-2 border-primary-200 bg-white text-primary-700 px-6 py-3 rounded-full font-semibold hover:bg-primary-50 transition-all flex items-center justify-center gap-2"
            >
              {trust.whatsappPhone ? 'O escríbenos por WhatsApp' : 'O escríbenos por correo'}
              <MessageCircle className="w-5 h-5" />
            </a>
            {trust.launchBenefits.length > 0 && (
              <div className="mt-6 bg-gradient-to-r from-primary-100 to-secondary-100 rounded-2xl p-4 border-2 border-primary-200">
                <div className="flex items-start gap-3">
                  <Gift className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-primary-900 mb-1">Beneficios de lanzamiento:</p>
                    <ul className="text-sm text-primary-800 space-y-1">
                      {trust.launchBenefits.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                Algunos de nuestros servicios
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-4 text-center hover:shadow-lg transition-all transform hover:scale-105 border-2 border-primary-100 hover:border-primary-300"
                  >
                    <div className="flex justify-center mb-2"><ServiceIcon slug={service.slug} size="lg" /></div>
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
