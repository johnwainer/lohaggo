import Link from 'next/link'
import { Search, Star, Shield, Zap, Clock, Users, CheckCircle, ArrowRight, Sparkles, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import SearchBar from '@/components/SearchBar'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    take: 12
  })

  const popularServices = await prisma.service.findMany({
    where: { popular: true },
    include: {
      category: true,
      _count: {
        select: { partners: true }
      }
    },
    take: 8,
    orderBy: { name: 'asc' }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Estilo Rappi */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] text-white pt-24 pb-32 md:pt-28 md:pb-40">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-300 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold mb-8 border border-white/30">
              <Sparkles className="w-4 h-4" />
              <span>Todo lo que necesitas, cuando lo necesitas</span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tight">
              Servicios a tu
              <span className="block bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent">alcance</span>
            </h1>

            <p className="text-xl md:text-2xl mb-12 text-white/90 font-medium max-w-2xl mx-auto">
              Encuentra profesionales verificados en minutos. Rápido, fácil y confiable.
            </p>

            <div className="max-w-3xl mx-auto mb-16">
              <SearchBar />
            </div>

            <div className="flex flex-wrap justify-center gap-8 md:gap-12">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/30">
                  <Users className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <div className="text-3xl font-black">50K+</div>
                  <div className="text-white/80 text-sm font-medium">Usuarios activos</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/30">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <div className="text-3xl font-black">100K+</div>
                  <div className="text-white/80 text-sm font-medium">Servicios completados</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/30">
                  <Star className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <div className="text-3xl font-black">4.9/5</div>
                  <div className="text-white/80 text-sm font-medium">Calificación promedio</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section - Estilo Rappi con scroll horizontal */}
      <section className="py-12 bg-white -mt-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900">Categorías populares</h2>
              <Link href="/servicios" className="text-[#FF2D55] font-bold flex items-center gap-1 hover:gap-2 transition-all">
                Ver todas
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-4 pb-4">
                {categories.map((category: any) => (
                  <Link
                    key={category.id}
                    href={`/servicios?category=${category.slug}`}
                    className="flex-shrink-0 w-32 group"
                  >
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 text-center hover:from-[#FF2D55]/10 hover:to-[#FF6900]/10 transition-all hover:shadow-lg border-2 border-transparent hover:border-[#FF2D55]/20">
                      <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">{category.icon}</div>
                      <h3 className="font-bold text-sm text-gray-800 group-hover:text-[#FF2D55] transition line-clamp-2">
                        {category.name}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4 text-gray-900">¿Por qué LoHaggo?</h2>
            <p className="text-gray-600 text-lg font-medium">La forma más rápida y segura de contratar servicios</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="bg-gradient-to-br from-[#FF2D55] to-[#FF6900] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Súper rápido</h3>
              <p className="text-gray-600 font-medium">Contrata en minutos, no en días</p>
            </div>

            <div className="bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="bg-gradient-to-br from-[#FF6900] to-[#FFB800] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">100% verificado</h3>
              <p className="text-gray-600 font-medium">Profesionales con identidad confirmada</p>
            </div>

            <div className="bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="bg-gradient-to-br from-[#FFB800] to-[#FFC107] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Mejor calidad</h3>
              <p className="text-gray-600 font-medium">Reseñas reales de clientes verificados</p>
            </div>

            <div className="bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all group border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="bg-gradient-to-br from-[#FF2D55] to-[#C2185B] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Precios justos</h3>
              <p className="text-gray-600 font-medium">Compara y elige la mejor opción</p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
                Servicios más populares
              </h2>
              <p className="text-gray-600 font-medium">Los más solicitados por nuestros usuarios</p>
            </div>
            <Link href="/servicios" className="hidden md:flex text-[#FF2D55] font-bold items-center gap-1 hover:gap-2 transition-all">
              Ver todos
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularServices.map((service: any) => (
              <Link
                key={service.id}
                href={`/servicios/${service.slug}`}
                className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all overflow-hidden group border-2 border-gray-100 hover:border-[#FF2D55]/30"
              >
                <div className="h-44 bg-gradient-to-br from-[#FF2D55]/90 to-[#FF6900]/90 flex items-center justify-center text-7xl group-hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold px-3 py-1 bg-gradient-to-r from-[#FF2D55]/10 to-[#FF6900]/10 text-[#FF2D55] rounded-full border border-[#FF2D55]/20">
                      {service.category.name}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-gray-900 group-hover:text-[#FF2D55] transition">
                    {service.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2 font-medium">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-[#FFB800] fill-[#FFB800]" />
                      <span className="text-sm font-bold text-gray-900">4.8</span>
                      <span className="text-xs text-gray-500 ml-1">({service._count.partners})</span>
                    </div>
                    <span className="text-[#FF2D55] font-black text-lg">Desde {formatCurrency(service.basePrice)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/servicios"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-10 py-4 rounded-2xl hover:from-[#FF1D45] hover:to-[#FF5900] transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Ver todos los servicios
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#FF2D55] via-[#FF3D00] to-[#FF6900] text-white relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400 rounded-full mix-blend-overlay filter blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-400 rounded-full mix-blend-overlay filter blur-3xl"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-bold mb-8 border border-white/30">
            <Sparkles className="w-4 h-4" />
            <span>Únete a nuestra comunidad</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-black mb-6">¿Eres profesional?</h2>
          <p className="text-xl md:text-2xl mb-10 text-white/90 font-medium max-w-2xl mx-auto">
            Conecta con miles de clientes y haz crecer tu negocio
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/30">
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold">Sin comisiones ocultas</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/30">
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold">Pagos seguros</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/30">
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold">Soporte 24/7</span>
            </div>
          </div>

          <Link
            href="/register?role=partner"
            className="inline-flex items-center gap-2 bg-white text-[#FF2D55] px-10 py-5 rounded-2xl hover:bg-gray-100 transition-all font-black text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105"
          >
            Regístrate como socio
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Lo que dicen nuestros clientes</h2>
            <p className="text-gray-600 text-lg font-medium">Miles de personas confían en LoHaggo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-[#FFB800] fill-[#FFB800]" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 font-medium leading-relaxed">
                "Excelente servicio. Contraté un plomero y llegó en menos de 2 horas. Muy profesional y el precio fue justo."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#FF2D55] to-[#FF6900] rounded-full flex items-center justify-center text-white font-bold text-lg">
                  M
                </div>
                <div>
                  <div className="font-bold text-gray-900">María González</div>
                  <div className="text-sm text-gray-500">Cliente verificado</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-[#FFB800] fill-[#FFB800]" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 font-medium leading-relaxed">
                "La mejor plataforma para encontrar servicios. Rápida, confiable y con excelentes profesionales."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#FF2D55] to-[#FF6900] rounded-full flex items-center justify-center text-white font-bold text-lg">
                  J
                </div>
                <div>
                  <div className="font-bold text-gray-900">Juan Pérez</div>
                  <div className="text-sm text-gray-500">Cliente verificado</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-[#FF2D55]/20">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-[#FFB800] fill-[#FFB800]" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 font-medium leading-relaxed">
                "Increíble experiencia. El electricista que contraté fue muy profesional y resolvió mi problema rápidamente."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#FF2D55] to-[#FF6900] rounded-full flex items-center justify-center text-white font-bold text-lg">
                  A
                </div>
                <div>
                  <div className="font-bold text-gray-900">Ana Martínez</div>
                  <div className="text-sm text-gray-500">Cliente verificado</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
