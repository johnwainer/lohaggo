import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shield, Star, Zap, Users, Award, MessageCircle, Calendar, Heart, Sparkles, Mail } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import { WaitlistCard } from '@/components/city/WaitlistCard'
import { FaqList } from '@/components/public/ServiceSeoBlocks'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { prisma } from '@/lib/prisma'
import { fmtCount, STAT_MINIMUMS } from '@/lib/public/claims'
import { clientPayment, guarantee, verificationLong, verificationShort } from '@/lib/public/copy'
import { getPublicTrustSafe, publicContactExtras } from '@/lib/public/trust'
import { faqJsonLd, focusZones, FOCUS_SERVICE_SLUGS, serviceZonePath, type FaqItem } from '@/lib/public/serviceZones'
import { withRef } from '@/lib/public/whatsapp'
import { jsonLdScript } from '@/lib/marketing/seo'
import { RelatedGuides } from '@/components/public/RelatedGuides'
import { cityEnumOf, loadCity, type PublicCity } from '@/lib/seo/city'
import { getCatalogSafe, groupByCategory } from '@/lib/seo/data'
import { cityIsIndexable } from '@/lib/seo/indexing'
import { pesosCO } from '@/lib/seo/site'
import { ZONES } from '@/lib/geo/zones'

// The city page is server-rendered (Google used to receive «Ciudad no encontrada»); regenerated every 10 minutes
export const revalidate = 600

type Props = { params: Promise<{ slug: string }> }

export default async function CityPage({ params }: Props) {
  const { slug } = await params
  const city = await loadCity(slug)
  if (!city) notFound()
  return cityIsIndexable(city.status) ? <ActiveCityLanding city={city} /> : <ComingSoonCity city={city} />
}

const STEPS = [
  { title: 'Pides el servicio', description: 'Describe lo que necesitas, tu dirección y cuándo te sirve. Toma menos de 2 minutos.', icon: MessageCircle },
  { title: 'Recibes propuestas', description: 'Socios verificados te envían su oferta con precio y fecha.', icon: Users },
  { title: 'Eliges y agendas', description: 'Comparas, eliges la que más te convenga y coordinas por el chat.', icon: Calendar },
  { title: 'Te atienden en casa', description: 'El socio llega a tu dirección y hace el trabajo.', icon: Heart },
]

/* ───────────────────────────── Open city ───────────────────────────── */

async function ActiveCityLanding({ city }: { city: PublicCity }) {
  const enumCity = cityEnumOf(city.slug)
  const [trust, catalog, cityPartners] = await Promise.all([
    getPublicTrustSafe(),
    getCatalogSafe(),
    enumCity ? prisma.partnerProfile.count({ where: { verified: true, isActive: true, city: enumCity } }).catch(() => null) : Promise.resolve(null),
  ])
  const contact = await publicContactExtras(trust.claims)

  const withPartners = catalog.filter((s) => s.partners > 0)
  const groups = groupByCategory(withPartners)
  const showPartners = trust.claims.trust_real_stats && cityPartners !== null && cityPartners >= STAT_MINIMUMS.verifiedPartners
  const guaranteeText = guarantee(trust)
  const hasZones = city.slug === 'medellin'
  const nameBySlug = new Map(catalog.map((s) => [s.slug, s.name]))
  const cheapest = withPartners.length ? Math.min(...withPartners.map((s) => s.from)) : null

  const faq: FaqItem[] = [
    {
      q: `¿Cuánto cuesta un servicio a domicilio en ${city.name}?`,
      a: `Depende del servicio y del trabajo. ${cheapest !== null ? `Los precios base parten desde ${pesosCO(cheapest)} COP y cada página de servicio muestra su «desde». ` : ''}Cada socio te envía su propuesta con precio y tú eliges antes de confirmar. En /precios hay rangos de referencia.`,
    },
    {
      q: '¿Los socios están verificados?',
      a: `Sí. ${verificationLong(trust)}${showPartners ? ` Hoy hay ${fmtCount(cityPartners as number)} socios verificados en ${city.name}.` : ''}`,
    },
    { q: '¿Cómo pago?', a: clientPayment(trust) },
    ...(hasZones
      ? [{ q: `¿Qué zonas de ${city.name} cubren?`, a: `Medellín y el Valle de Aburrá: ${ZONES.slice(0, 8).map((z) => z.name).join(', ')} y más. La cobertura depende de cada socio; al pedir indicas tu dirección y los socios que atienden tu zona te envían su propuesta.` }]
      : []),
    ...(guaranteeText ? [{ q: '¿Qué pasa si el socio no llega o el trabajo queda mal?', a: guaranteeText }] : []),
    {
      q: `¿Cómo pido un servicio en ${city.name}?`,
      a: contact.whatsappPhone
        ? 'Crea la solicitud en la web o escríbenos por WhatsApp y la creamos por ti. Luego recibes las propuestas de los socios y eliges.'
        : 'Crea la solicitud en la web en pocos pasos. Luego recibes las propuestas de los socios y eliges.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faq)) }} />

      <section className="bg-gradient-to-br from-primary-600 to-secondary-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
          <nav aria-label="Ruta" className="text-sm text-white/80">
            <Link href="/" className="hover:underline">Inicio</Link> <span aria-hidden>›</span> {city.name}
          </nav>
          <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">Servicios a domicilio en {city.name}</h1>
          <p className="mt-3 max-w-2xl text-base text-white/90 md:text-lg">
            Plomeros, electricistas, limpieza, pintura y más en {city.name}. Pides, recibes propuestas con precio de socios
            verificados y eliges la que más te convenga.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <WhatsAppButton phone={contact.whatsappPhone} message={withRef(`Hola, necesito un servicio en ${city.name}`, `web-ciudad-${city.slug}`)} refTag={`web-ciudad-${city.slug}`} className="w-full sm:w-auto" trackData={{ placement: 'city-hero' }} />
            <Link href="/servicios" className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-white px-6 py-3 text-base font-bold text-primary-700 shadow-lg sm:w-auto">
              Ver todos los servicios
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
            {showPartners && <span className="rounded-full bg-white/15 px-3 py-1.5">{fmtCount(cityPartners as number)} socios verificados</span>}
            <span className="rounded-full bg-white/15 px-3 py-1.5">{verificationLong(trust).replace(/\.$/, '')}</span>
            <span className="rounded-full bg-white/15 px-3 py-1.5">{clientPayment(trust).replace(/\.$/, '')}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <section aria-labelledby="servicios-ciudad" className="mt-10">
          <h2 id="servicios-ciudad" className="text-2xl font-bold text-gray-900">Servicios disponibles en {city.name}</h2>
          <p className="mt-2 text-gray-600">Precio base de cada servicio. El valor final lo define la propuesta del socio.</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.slug}>
                <h3 className="text-lg font-bold text-gray-900">{g.name}</h3>
                <ul className="mt-3 space-y-2">
                  {g.services.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/servicios/${s.slug}`} className="flex items-baseline justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:border-primary-200 hover:bg-primary-50">
                        <span className="font-semibold text-gray-800">{s.name}</span>
                        <span className="shrink-0 text-sm text-gray-500">desde {pesosCO(s.from)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-gray-600">
            ¿Quieres una referencia más real? Mira los <Link href="/precios" className="font-semibold text-primary-700 underline">precios típicos por servicio</Link>.
          </p>
        </section>

        {hasZones && (
          <section aria-labelledby="zonas-ciudad" className="mt-10">
            <h2 id="zonas-ciudad" className="text-2xl font-bold text-gray-900">Zonas que atendemos</h2>
            <p className="mt-2 text-gray-600">Comunas de Medellín y municipios del Valle de Aburrá. Al pedir indicas tu dirección y los socios que cubren tu zona te envían su propuesta.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {ZONES.map((z) => (
                <li key={z.key} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">{z.name}</li>
              ))}
            </ul>
            {FOCUS_SERVICE_SLUGS.filter((s) => nameBySlug.has(s)).map((s) => (
              <div key={s} className="mt-5">
                <p className="font-semibold text-gray-900">{nameBySlug.get(s)} por zona</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {focusZones().map((z) => (
                    <li key={z.key}>
                      <Link href={serviceZonePath(s, z.key)} className="inline-flex min-h-[40px] items-center rounded-full border border-primary-100 bg-primary-50 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                        {nameBySlug.get(s)} en {z.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <HowItWorksCity />

        <section aria-labelledby="garantia-ciudad" className="mt-10 rounded-3xl border border-gray-100 bg-gray-50 p-6">
          <h2 id="garantia-ciudad" className="text-xl font-bold text-gray-900">{guaranteeText ? 'Garantía LoHaggo' : 'Confianza'}</h2>
          <p className="mt-2 leading-7 text-gray-700">{guaranteeText ?? verificationLong(trust)}</p>
          {guaranteeText && <p className="mt-2 text-sm"><Link href="/garantia" className="font-semibold text-primary-700 underline">Ver la garantía completa</Link></p>}
        </section>

        <FaqList items={faq} title={`Preguntas frecuentes sobre servicios en ${city.name}`} />

        <RelatedGuides max={4} className="mt-10 rounded-3xl border" />

        <div className="mt-10 rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-500 p-6 text-white">
          <p className="text-lg font-bold">¿Qué necesitas resolver hoy?</p>
          <p className="mt-1 text-sm text-white/90">Pide el servicio y recibe propuestas de socios verificados en {city.name}.</p>
          <Link href="/servicios" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-base font-bold text-primary-700 hover:bg-white/90">
            Ver servicios
          </Link>
        </div>
      </div>
    </div>
  )
}

/** The generic «Cómo funciona» steps (the HowItWorks block is per service; this one is for the city). */
function HowItWorksCity() {
  return (
    <section aria-labelledby="como-funciona-ciudad" className="mt-10">
      <h2 id="como-funciona-ciudad" className="text-2xl font-bold text-gray-900">Cómo funciona</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{i + 1}</span>
            <p className="mt-3 font-semibold text-gray-900">{s.title}</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">{s.description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ─────────────────────────── Coming-soon city ─────────────────────────── */

const SOON_SERVICES = [
  { name: 'Plomería', slug: 'plomeria' },
  { name: 'Electricidad', slug: 'electricidad' },
  { name: 'Limpieza', slug: 'limpieza-hogar' },
  { name: 'Belleza', slug: 'manicure-pedicure' },
  { name: 'Carpintería', slug: 'carpinteria' },
  { name: 'Pintura', slug: 'pintura' },
  { name: 'Jardinería', slug: 'jardineria' },
  { name: 'Mudanzas', slug: 'mudanzas' },
  { name: 'Masajes', slug: 'masajes' },
  { name: 'Cerrajería', slug: 'cerrajeria' },
  { name: 'Aire Acondicionado', slug: 'reparacion-aires' },
  { name: 'Tecnología', slug: 'soporte-tecnico' },
]

async function ComingSoonCity({ city }: { city: PublicCity }) {
  const trust = await getPublicTrustSafe()
  const contact = await publicContactExtras(trust.claims)
  const guaranteeText = guarantee(trust)

  const benefits = [
    { icon: Zap, title: 'Solicita en línea', description: 'Describe lo que necesitas y recibe propuestas de profesionales.' },
    { icon: Shield, title: verificationShort(trust), description: verificationLong(trust) },
    ...(guaranteeText ? [{ icon: Star, title: 'Garantía de servicio', description: guaranteeText }] : []),
    { icon: Users, title: 'Red de expertos', description: 'Profesionales verificados de distintos oficios.' },
    { icon: Award, title: 'Mejor precio', description: 'Compara propuestas y elige la que mejor se ajuste.' },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <header className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-3 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-bold">¡Próximamente en tu ciudad!</span>
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 bg-clip-text text-5xl font-black text-transparent sm:text-7xl">
            LoHaggo llega a {city.name}
          </h1>
          {city.launchDate && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-primary-200 bg-white/80 px-5 py-2.5 text-lg font-bold text-gray-800 shadow">
              <Calendar className="h-5 w-5 text-primary-600" />
              Lanzamiento: {new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(city.launchDate)}
            </p>
          )}
          <p className="mx-auto max-w-2xl text-xl leading-relaxed text-gray-600">
            Estamos preparando la plataforma para {city.name}. Pronto podrás contratar servicios a domicilio con socios verificados.
            Déjanos tu correo y te avisamos cuando abramos.
          </p>
        </header>

        <section aria-labelledby="avisame" className="mb-14 rounded-3xl border-2 border-primary-200 bg-gradient-to-br from-white to-primary-50 p-6 shadow-2xl sm:p-10">
          <h2 id="avisame" className="mb-6 text-center text-3xl font-black text-gray-900">¡Sé el primero en saberlo!</h2>
          <WaitlistCard citySlug={city.slug} cityName={city.name} whatsappPhone={contact.whatsappPhone} launchBenefits={contact.launchBenefits} />
        </section>

        <section aria-labelledby="por-que" className="mb-14">
          <h2 id="por-que" className="mb-6 text-center text-3xl font-black text-gray-900">¿Por qué LoHaggo?</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border-2 border-gray-100 bg-white p-6 shadow-lg">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
                  <b.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-black text-gray-900">{b.title}</h3>
                <p className="leading-relaxed text-gray-600">{b.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="servicios-pronto" className="mb-14 rounded-3xl border-2 border-primary-100 bg-white p-6 shadow-xl sm:p-8">
          <h2 id="servicios-pronto" className="mb-6 text-center text-3xl font-black text-gray-900">Algunos de nuestros servicios</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SOON_SERVICES.map((s) => (
              <li key={s.slug} className="rounded-xl border-2 border-primary-100 bg-gradient-to-br from-primary-50 to-secondary-50 p-4 text-center">
                <div className="mb-2 flex justify-center"><ServiceIcon slug={s.slug} size="lg" /></div>
                <div className="text-sm font-bold text-gray-700">{s.name}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-gray-500">Y muchos más.</p>
        </section>

        <HowItWorksCity />

        <div className="mt-14 space-y-4 text-center">
          <a href="mailto:hola@lohaggo.com" className="inline-flex items-center gap-2 font-semibold text-gray-600 hover:text-primary-500">
            <Mail className="h-5 w-5" /> hola@lohaggo.com
          </a>
          <div>
            <Link href="/servicios" className="font-bold text-primary-600 hover:underline">Ver los servicios disponibles hoy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
