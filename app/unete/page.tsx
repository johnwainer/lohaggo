import { Metadata } from 'next'
import UneteClient from './UneteClient'
import { getPublicTrustSafe } from '@/lib/public/trust'
import { fmtCount } from '@/lib/public/claims'

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
    const trust = await getPublicTrustSafe()
    return <UneteClient trust={trust} />
}
