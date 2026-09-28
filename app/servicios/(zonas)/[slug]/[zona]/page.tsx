import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { coversZone, zoneByKey } from '@/lib/geo/zones'
import { jsonLdScript, SITE_URL } from '@/lib/marketing/seo'
import { firstNameInitial, getPublicTrustSafe, publicWhatsappPhone } from '@/lib/public/trust'
import { withRef } from '@/lib/public/whatsapp'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { RemoteImage } from '@/components/ui/RemoteImage'
import { FaqList, HowItWorks, ZoneLinks } from '@/components/public/ServiceSeoBlocks'
import {
  faqJsonLd, focusPairs, focusZones, isFocusService, isFocusZone, pesos, serviceFaq, serviceZonePath, typicalJobs, zoneWhere,
} from '@/lib/public/serviceZones'

// Lives in a route group so the /servicios/[slug] layout (its hero, H1 and JSON-LD) doesn't wrap it
export const revalidate = 3600
export const dynamicParams = false

type Props = { params: Promise<{ slug: string; zona: string }> }

export function generateStaticParams() {
  return focusPairs()
}

const MAX_CARDS = 6

const loadLanding = cache(async (slug: string, zona: string) => {
  const zone = zoneByKey(zona)
  if (!zone || !isFocusService(slug) || !isFocusZone(zona)) return null
  const service = await prisma.service.findUnique({
    where: { slug },
    select: { id: true, name: true, description: true, basePrice: true },
  })
  if (!service) return null
  const partnerWhere = { verified: true, isActive: true }
  const [verifiedPartners, rows] = await Promise.all([
    prisma.partnerService.count({ where: { serviceId: service.id, active: true, partner: partnerWhere } }),
    prisma.partnerService.findMany({
      where: { serviceId: service.id, active: true, partner: { ...partnerWhere, city: 'MEDELLIN' } },
      select: {
        partner: {
          select: {
            id: true, slug: true, isPublicProfile: true, coverageZones: true, rating: true, totalReviews: true,
            profileHeadline: true, isCompany: true, companyName: true, user: { select: { name: true, image: true } },
          },
        },
      },
      take: 500,
    }),
  ])
  if (verifiedPartners === 0) return null

  // Partners that listed the zone first, then those that cover the whole city (no zones)
  const partners = rows
    .map((r) => r.partner)
    .filter((p) => coversZone(p.coverageZones, zone.key))
    .sort((a, b) =>
      Number(b.coverageZones.includes(zone.key)) - Number(a.coverageZones.includes(zone.key))
      || b.totalReviews - a.totalReviews
      || b.rating - a.rating,
    )
    .slice(0, MAX_CARDS)
    .map((p) => ({
      id: p.id,
      name: p.isCompany && p.companyName ? p.companyName : firstNameInitial(p.user.name),
      image: p.user.image,
      headline: p.profileHeadline,
      href: p.slug && p.isPublicProfile ? `/pro/${p.slug}` : null,
      rating: p.totalReviews > 0 && p.rating > 0 ? { value: p.rating.toFixed(1), reviews: p.totalReviews } : null,
      listsZone: p.coverageZones.includes(zone.key),
    }))

  return { service, zone, partners, medellinPartners: rows.length }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, zona } = await params
  const data = await loadLanding(slug, zona)
  if (!data) return { title: 'Página no encontrada – LoHaggo', robots: { index: false } }
  const { service, zone } = data
  const title = `${service.name} en ${zone.name}, Medellín | LoHaggo`
  const description = `Pide ${service.name.toLowerCase()} en ${zone.name} con LoHaggo: recibe propuestas de socios verificados y elige. Desde ${pesos(service.basePrice)} COP.`
  const url = `${SITE_URL}${serviceZonePath(slug, zona)}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url, siteName: 'LoHaggo', locale: 'es_CO', type: 'website',
      images: [{ url: `${SITE_URL}/icon-512.png`, width: 512, height: 512, alt: `${service.name} en ${zone.name} – LoHaggo` }],
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function ServiceZonePage({ params }: Props) {
  const { slug, zona } = await params
  const data = await loadLanding(slug, zona)
  if (!data) notFound()
  const { service, zone, partners, medellinPartners } = data
  const [trust, phone] = await Promise.all([getPublicTrustSafe(), publicWhatsappPhone().catch(() => null)])

  const svc = service.name.toLowerCase()
  const url = `${SITE_URL}${serviceZonePath(slug, zona)}`
  const jobs = typicalJobs(slug)
  const faq = serviceFaq({ serviceName: service.name, basePrice: service.basePrice, medellinPartners, trust, hasWhatsapp: Boolean(phone), zone })
  const waRef = `web-${slug}-${zona}`
  const waMessage = withRef(`Hola, necesito ${svc} en ${zone.name}`, waRef)
  const waLink = Boolean(phone)
  const otherZones = focusZones()
    .filter((z) => z.key !== zone.key)
    .map((z) => ({ href: serviceZonePath(slug, z.key), label: `${service.name} en ${z.name}` }))

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `${service.name} en ${zone.name}`,
      serviceType: service.name,
      description: service.description,
      url,
      provider: { '@type': 'Organization', name: 'LoHaggo', url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
      areaServed: {
        '@type': zone.kind === 'municipio' ? 'AdministrativeArea' : 'Place',
        name: zone.name,
        containedInPlace: { '@type': 'City', name: 'Medellín' },
      },
      offers: { '@type': 'AggregateOffer', lowPrice: service.basePrice, priceCurrency: 'COP', url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Servicios', item: `${SITE_URL}/servicios` },
        { '@type': 'ListItem', position: 3, name: service.name, item: `${SITE_URL}/servicios/${slug}` },
        { '@type': 'ListItem', position: 4, name: zone.name, item: url },
      ],
    },
    faqJsonLd(faq),
  ]

  return (
    <main className="min-h-screen overflow-x-hidden bg-gray-50 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <section className="bg-gradient-to-br from-primary-600 to-primary-800 px-4 pb-8 pt-6 text-white">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Ruta" className="text-xs text-white/80">
            <Link href="/" className="hover:text-white">Inicio</Link> <span aria-hidden>›</span>{' '}
            <Link href="/servicios" className="hover:text-white">Servicios</Link> <span aria-hidden>›</span>{' '}
            <Link href={`/servicios/${slug}`} className="hover:text-white">{service.name}</Link> <span aria-hidden>›</span>{' '}
            <span>{zone.name}</span>
          </nav>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{service.name} en {zone.name}</h1>
          <p className="mt-2 text-sm leading-6 text-white/90 sm:text-base">
            {zoneWhere(zone)}. Pide {svc} en LoHaggo y recibe propuestas de socios verificados que atienden la zona.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold">Desde {pesos(service.basePrice)} COP</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            {waLink && <WhatsAppButton phone={phone} message={waMessage} refTag={waRef} label="Pedir por WhatsApp" trackData={{ placement: 'zone-landing', service: slug, zone: zona }} />}
            <Link
              href={`/servicios/${slug}`}
              className={`inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-base font-bold ${waLink ? 'bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25' : 'bg-white text-primary-700 hover:bg-white/90'}`}
            >
              Pedir en la web
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4">
        <section className="mt-8" aria-labelledby="trabajos">
          <h2 id="trabajos" className="text-xl font-bold text-gray-900">Trabajos de {svc} que puedes pedir en {zone.name}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{service.description}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {jobs.map((j) => (
              <li key={j} className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-sm text-gray-700 shadow-sm">
                <span aria-hidden className="mt-0.5 text-primary-600">✓</span>
                <span>{j}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            El precio de {svc} parte desde {pesos(service.basePrice)} COP. Cada socio revisa lo que necesitas y te envía su propuesta con el
            precio final, así comparas antes de elegir.
          </p>
        </section>

        {partners.length > 0 && (
          <section className="mt-8" aria-labelledby="socios">
            <h2 id="socios" className="text-xl font-bold text-gray-900">Socios de {svc} que atienden {zone.name}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {partners.map((p) => {
                const body = (
                  <>
                    {p.image ? (
                      <RemoteImage src={p.image} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                        {p.name.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900">{p.name}</span>
                      {p.headline && <span className="block truncate text-xs text-gray-500">{p.headline}</span>}
                      <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">Verificado</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{p.listsZone ? `Cubre ${zone.name}` : 'Cubre toda la ciudad'}</span>
                        {p.rating && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">★ {p.rating.value} · {p.rating.reviews} reseñas</span>}
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={p.id}>
                    {p.href ? (
                      <Link href={p.href} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow-md">{body}</Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <HowItWorks serviceName={service.name} />
        <FaqList items={faq} />
        <ZoneLinks title={`${service.name} en otras zonas`} links={otherZones} />

        <div className="mt-10 rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-500 p-6 text-white">
          <p className="text-lg font-bold">¿Necesitas {svc} en {zone.name}?</p>
          <p className="mt-1 text-sm text-white/90">Crea tu solicitud y recibe propuestas de socios verificados.</p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            {waLink && <WhatsAppButton phone={phone} message={waMessage} refTag={waRef} label="Pedir por WhatsApp" trackData={{ placement: 'zone-landing', service: slug, zone: zona }} />}
            <Link href={`/servicios/${slug}`} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 text-base font-bold text-primary-700 hover:bg-white/90">
              Pedir en la web
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
