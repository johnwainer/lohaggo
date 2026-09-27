import { Metadata } from 'next'
import UneteClient from './UneteClient'
import { getPublicTrustSafe } from '@/lib/public/trust'
import { fmtCount } from '@/lib/public/claims'
import { unstable_cache } from 'next/cache'
import { City } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Catalog services that at least one verified, active partner offers in Medellín today. */
const servicesWithVerifiedPartnersInMedellin = unstable_cache(
    () => prisma.service.count({
        where: { partners: { some: { active: true, city: City.MEDELLIN, partner: { verified: true, isActive: true } } } },
    }),
    ['unete-services-medellin-v1'],
    { revalidate: 600 },
)

export const revalidate = 600

export async function generateMetadata(): Promise<Metadata> {
    const trust = await getPublicTrustSafe()
    const n = trust.stats.verifiedPartners
    const social = n !== null
        ? `${fmtCount(n)} socios verificados ya reciben clientes en LoHaggo.`
        : 'Únete a los socios verificados de LoHaggo.'
    return {
        title: { absolute: 'Únete como profesional y recibe clientes | LoHaggo' },
        description: 'Regístrate gratis en LoHaggo y empieza a recibir clientes en tu ciudad. Plomeros, electricistas, limpieza y más. Sin jefes, tú controlas tu tiempo.',
        openGraph: {
            title: '¿Eres profesional? Únete a LoHaggo y recibe clientes hoy',
            description: `${social} Regístrate gratis y recibe solicitudes de clientes en tu ciudad. Sin suscripciones.`,
            url: 'https://www.lohaggo.com/unete',
            siteName: 'LoHaggo',
            images: [
                {
                    url: 'https://www.lohaggo.com/icon-512.png',
                    width: 512,
                    height: 512,
                    alt: 'Únete a LoHaggo como profesional y recibe clientes',
                },
            ],
            locale: 'es_CO',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: '¿Eres profesional? Únete a LoHaggo y recibe clientes hoy',
            description: `${social} Regístrate gratis.`,
            images: ['https://www.lohaggo.com/icon-512.png'],
        },
        alternates: {
            canonical: 'https://www.lohaggo.com/unete',
        },
    }
}

export default async function UnetePage() {
    const [trust, services] = await Promise.all([
        getPublicTrustSafe(),
        servicesWithVerifiedPartnersInMedellin().catch(() => 0),
    ])
    // Real number only, and only while the platform shows real stats
    const servicesInMedellin = trust.claims.trust_real_stats && services > 0 ? services : null
    return <UneteClient trust={trust} servicesInMedellin={servicesInMedellin} />
}
