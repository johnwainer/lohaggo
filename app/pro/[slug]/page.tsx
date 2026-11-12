import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ProfileClient from './ProfileClient'
import { partnerIsIndexable } from '@/lib/seo/indexing'
import { defaultOgImages, SITE_URL } from '@/lib/seo/site'

type Props = { params: Promise<{ slug: string }> }

const CITY_NAMES: Record<string, string> = {
  MEDELLIN: 'Medellín',
  BOGOTA: 'Bogotá',
  CALI: 'Cali',
  BARRANQUILLA: 'Barranquilla',
}

async function fetchPartner(slug: string) {
  const partner = await prisma.partnerProfile.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, image: true } },
      services: {
        where: { active: true },
        include: { service: { select: { name: true, icon: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
        take: 12,
      },
      workPhotos: { orderBy: { order: 'asc' }, take: 12 },
      achievements: {
        include: { achievement: { select: { name: true, icon: true, type: true } } },
        orderBy: { unlockedAt: 'desc' },
      },
    },
  })
  if (!partner || !partner.isPublicProfile) return null

  const backgroundDoc = await prisma.verificationDocument.findFirst({
    where: { partnerId: partner.id, type: 'ANTECEDENTES' as any, status: 'APPROVED' },
    select: { id: true },
  })

  const reviews = await prisma.review.findMany({
    where: { clientToPartnerRating: { not: null }, booking: { partnerId: partner.id } },
    include: {
      booking: {
        select: {
          user: { select: { name: true, image: true } },
          service: { select: { name: true } },
        },
      },
    },
    orderBy: { clientReviewedAt: 'desc' },
    take: 8,
  })

  return {
    id: partner.id,
    slug: partner.slug ?? slug,
    name: partner.user.name ?? 'Socio',
    image: partner.user.image,
    city: partner.city as string,
    cityName: CITY_NAMES[partner.city] ?? partner.city,
    bio: partner.bio,
    profileHeadline: partner.profileHeadline,
    isAvailable: partner.isAvailable,
    rating: partner.rating,
    totalReviews: partner.totalReviews,
    completedServicesCount: partner.completedServicesCount,
    verified: partner.verified,
    isCompany: partner.isCompany,
    companyName: partner.companyName,
    hasBackgroundCheck: !!backgroundDoc,
    createdAt: partner.createdAt.toISOString(),
    services: partner.services.map((ps) => ({
      id: ps.id,
      name: ps.service.name,
      icon: ps.service.icon,
      slug: ps.service.slug,
      price: ps.price,
    })),
    workPhotos: partner.workPhotos.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
    })),
    achievements: partner.achievements.map((pa) => ({
      id: pa.id,
      name: pa.achievement.name,
      icon: pa.achievement.icon,
      type: pa.achievement.type,
      unlockedAt: pa.unlockedAt.toISOString(),
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.clientToPartnerRating ?? 0,
      comment: r.clientToPartnerComment,
      reviewedAt: r.clientReviewedAt?.toISOString() ?? null,
      service: r.booking.service?.name ?? null,
      reviewer: {
        name: r.booking.user?.name ?? 'Cliente',
        image: r.booking.user?.image ?? null,
      },
    })),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const partner = await fetchPartner(slug)
  if (!partner) return { title: 'Perfil no encontrado', robots: { index: false, follow: true } }

  // The root layout's title template adds « | LoHaggo»
  const title = `${partner.name} · Socio en ${partner.cityName}`
  const serviceNames = partner.services.slice(0, 3).map((s) => s.name.toLowerCase()).join(', ')
  const reviewsLine = partner.totalReviews > 0 ? ` ${partner.totalReviews} reseñas · ${partner.rating.toFixed(1)}★.` : ''
  const description =
    partner.profileHeadline ||
    partner.bio ||
    `${partner.name} ofrece ${serviceNames || 'servicios profesionales'} en ${partner.cityName} con LoHaggo.${reviewsLine}`
  const hasPhoto = Boolean(partner.image)
  const images = hasPhoto
    ? [{ url: partner.image as string, width: 400, height: 400, alt: partner.name ?? 'Socio LoHaggo' }]
    : defaultOgImages(partner.name ?? 'Socio LoHaggo')
  const url = `${SITE_URL}/pro/${partner.slug}`

  return {
    title,
    description,
    openGraph: { title, description, url, siteName: 'LoHaggo', locale: 'es_CO', type: 'profile', images },
    twitter: { card: hasPhoto ? 'summary' : 'summary_large_image', title, description, images: images.map((i) => i.url) },
    alternates: { canonical: url },
    // Thin profiles (no reviews, and no bio plus photo) stay out of Google
    robots: partnerIsIndexable({ totalReviews: partner.totalReviews, bio: partner.bio, image: partner.image }) ? undefined : { index: false, follow: true },
  }
}

export default async function ProProfilePage({ params }: Props) {
  const { slug } = await params
  const partner = await fetchPartner(slug)
  if (!partner) notFound()

  const BASE_URL = 'https://www.lohaggo.com'
  const url = `${BASE_URL}/pro/${partner!.slug}`
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: partner!.name,
    url,
    image: partner!.image ?? undefined,
    description: partner!.profileHeadline ?? partner!.bio ?? undefined,
    jobTitle: partner!.services.map((s) => s.name).join(', '),
    worksFor: { '@type': 'Organization', name: 'LoHaggo', url: BASE_URL },
    address: {
      '@type': 'PostalAddress',
      addressLocality: partner!.cityName,
      addressCountry: 'CO',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileClient partner={partner!} />
    </>
  )
}
