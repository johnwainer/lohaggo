import Link from 'next/link'
import { Metadata } from 'next'
import {
  Target,
  Users,
  Heart,
  Award,
  Zap,
  Shield,
  TrendingUp,
  Globe,
  CheckCircle,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  DollarSign
} from 'lucide-react'
import { getPublicTrustSafe } from '@/lib/public/trust'
import { fmtCount } from '@/lib/public/claims'

export const metadata: Metadata = {
  title: 'Acerca de Nosotros - LoHaggo | Plataforma de Servicios Profesionales en Colombia',
  description: 'Descubre LoHaggo, la plataforma en Colombia para contratar servicios profesionales. Conectamos clientes con expertos verificados en plomería, electricidad, limpieza y más.',
  openGraph: {
    title: 'Acerca de LoHaggo - Conectando Profesionales con Clientes',
    description: 'Conoce cómo LoHaggo está revolucionando la forma de contratar servicios profesionales en Colombia.',
    url: 'https://www.lohaggo.com/about',
  },
  alternates: {
    canonical: '/about',
  },
}

export const revalidate = 600

export default async function AboutPage() {
  const trust = await getPublicTrustSafe()
  // Real numbers only, each above its minimum; the section hides itself when none qualifies
  const stats = [
    trust.stats.verifiedPartners !== null && { icon: Users, value: fmtCount(trust.stats.verifiedPartners), label: 'Socios verificados' },
    trust.stats.completedServices !== null && { icon: CheckCircle, value: fmtCount(trust.stats.completedServices), label: 'Servicios completados' },
    trust.stats.rating !== null && { icon: Star, value: `${trust.stats.rating.value.toFixed(1)}/5`, label: `Calificación (${fmtCount(trust.stats.rating.reviews)} reseñas)` },
    trust.stats.activeCities.length > 0 && { icon: Globe, value: String(trust.stats.activeCities.length), label: trust.stats.activeCities.length === 1 ? 'Ciudad activa' : 'Ciudades activas' },
  ].filter((x): x is { icon: typeof Users; value: string; label: string } => Boolean(x))
  const showStats = trust.stats.verifiedPartners !== null || trust.stats.completedServices !== null || trust.stats.rating !== null

  const values = [
    {
      icon: Shield,
      title: 'Confianza',
      description: trust.claims.trust_background_check
        ? 'Revisamos identidad y antecedentes de cada profesional antes de que reciba solicitudes.'
        : 'Verificamos la identidad de cada profesional antes de que reciba solicitudes.'
    },
    {
      icon: Zap,
      title: 'Rapidez',
      description: 'Solicitas en línea y recibes propuestas sin llamadas ni esperas innecesarias. Tu tiempo es valioso.'
    },
    {
      icon: Heart,
      title: 'Compromiso',
      description: 'Nos dedicamos a crear experiencias excepcionales para clientes y profesionales por igual.'
    },
    {
      icon: Award,
      title: 'Excelencia',
      description: 'Buscamos constantemente mejorar nuestra plataforma y el servicio que ofrecemos.'
    }
  ]

  const milestones = [
    {
      year: '2024',
      title: 'Fundación',
      description: 'LoHaggo nace con la visión de revolucionar el mercado de servicios profesionales.'
    },
    {
      year: '2024',
      title: 'Desarrollo',
      description: 'Construcción de la plataforma y desarrollo de funcionalidades core.'
    },
    {
      year: '2025',
      title: 'Consolidación',
      description: 'Pruebas exhaustivas, reclutamiento de equipo y preparación para el lanzamiento.'
    },
    {
      year: '2025',
      title: 'Beta Testing',
      description: 'Programa piloto con usuarios seleccionados para validar la plataforma.'
    },
    {
      year: '2026',
      title: 'Lanzamiento Oficial',
      description: 'Apertura al público y expansión en las principales ciudades de Colombia.'
    }
  ]

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
              <span>LoHaggo, Lo necesitas.</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              Sobre
              <span className="block bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent">LoHaggo</span>
            </h1>

            <p className="text-xl md:text-2xl mb-12 text-white/90 font-medium max-w-3xl mx-auto">
              La forma más simple de encontrar cualquier servicio.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section: real numbers only */}
      {showStats && <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-4xl font-black text-gray-900 mb-2">
                    {stat.value}
                  </div>
                  <div className="text-gray-600 font-semibold">
                    {stat.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>}

      {/* Mission Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-6">
                <Target className="w-4 h-4" />
                Nuestra Misión
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
                Democratizar el acceso a servicios profesionales
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed font-medium">
                En LoHaggo creemos que todos merecen acceso fácil, rápido y seguro a servicios profesionales de calidad.
                Nuestra misión es eliminar las barreras entre clientes y profesionales, creando un ecosistema donde
                ambos puedan prosperar.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed font-medium">
                Estamos en nuestro lanzamiento oficial de 2026, perfeccionando cada detalle de la plataforma.
                Usamos tecnología para verificar la identidad de los profesionales y hacer simple cada reserva:
                el cliente paga al terminar el servicio.
              </p>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-3xl p-12 shadow-2xl">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                    <Clock className="w-10 h-10 text-white mb-4" />
                    <div className="text-3xl font-black text-white mb-2">{trust.claims.trust_support_247 ? '24/7' : 'Chat'}</div>
                    <div className="text-white/90 font-semibold">
                      {trust.claims.trust_support_247
                        ? 'Por chat con asistente de IA; equipo humano en horario hábil'
                        : 'Por WhatsApp; equipo humano en horario hábil'}
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                    <Shield className="w-10 h-10 text-white mb-4" />
                    <div className="text-3xl font-black text-white mb-2">ID</div>
                    <div className="text-white/90 font-semibold">{trust.claims.trust_background_check ? 'Identidad y antecedentes verificados' : 'Identidad verificada'}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                    <DollarSign className="w-10 h-10 text-white mb-4" />
                    <div className="text-3xl font-black text-white mb-2">{trust.claims.trust_online_payment_protection ? 'Protegido' : 'Al final'}</div>
                    <div className="text-white/90 font-semibold">{trust.claims.trust_online_payment_protection ? 'Pago protegido hasta que confirmas' : 'Pagas al terminar'}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                    <TrendingUp className="w-10 h-10 text-white mb-4" />
                    <div className="text-3xl font-black text-white mb-2">2026</div>
                    <div className="text-white/90 font-semibold">Lanzamiento oficial</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              Nuestros valores
            </h2>
            <p className="text-xl text-gray-600 font-medium">
              Los principios que guían cada decisión que tomamos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon
              return (
                <div
                  key={index}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all transform hover:-translate-y-2"
                >
                  <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 font-medium leading-relaxed">
                    {value.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              Nuestra historia
            </h2>
            <p className="text-xl text-gray-600 font-medium">
              El camino que nos trajo hasta aquí
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-primary-500 to-secondary-500 hidden lg:block"></div>

            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="flex flex-col lg:flex-row gap-8 items-center"
                >
                  {/* Left Side */}
                  <div className="flex-1 lg:text-right">
                    {index % 2 === 0 ? (
                      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all">
                        <div className="text-5xl font-black bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-3">
                          {milestone.year}
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3">
                          {milestone.title}
                        </h3>
                        <p className="text-gray-600 font-medium">
                          {milestone.description}
                        </p>
                      </div>
                    ) : (
                      <div className="hidden lg:block"></div>
                    )}
                  </div>

                  {/* Center Circle */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center shadow-xl border-4 border-white">
                      <div className="w-6 h-6 bg-white rounded-full"></div>
                    </div>
                  </div>

                  {/* Right Side */}
                  <div className="flex-1 lg:text-left">
                    {index % 2 !== 0 ? (
                      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all">
                        <div className="text-5xl font-black bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-3">
                          {milestone.year}
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3">
                          {milestone.title}
                        </h3>
                        <p className="text-gray-600 font-medium">
                          {milestone.description}
                        </p>
                      </div>
                    ) : (
                      <div className="hidden lg:block"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            Únete a nuestra comunidad
          </h2>
          <p className="text-xl mb-10 text-white/90 font-medium">
            Forma parte de la revolución en servicios profesionales
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl"
            >
              Comenzar ahora
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all border-2 border-white/30"
            >
              Cómo funciona
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
