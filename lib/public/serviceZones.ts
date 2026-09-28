/**
 * Local SEO landings of service × zone (/servicios/[slug]/[zona]): the focus services and zones, and the
 * template texts. Written by hand (no AI) and without facts we can't back: only the service's typical jobs
 * and where the zone is. Pure.
 */
import { zoneByKey, type Zone } from '@/lib/geo/zones'
import { STAT_MINIMUMS, fmtCount } from '@/lib/public/claims'
import { clientPayment, verificationLong, type TrustLike } from '@/lib/public/copy'

export const FOCUS_SERVICE_SLUGS = ['plomeria', 'electricidad', 'pintura', 'limpieza-hogar'] as const
export const FOCUS_ZONE_KEYS = ['el-poblado', 'laureles', 'envigado', 'belen', 'sabaneta', 'bello'] as const

export const isFocusService = (slug: string | null | undefined) => (FOCUS_SERVICE_SLUGS as readonly string[]).includes(slug ?? '')
export const isFocusZone = (key: string | null | undefined) => (FOCUS_ZONE_KEYS as readonly string[]).includes(key ?? '')

export const focusZones = (): Zone[] => FOCUS_ZONE_KEYS.map((k) => zoneByKey(k)).filter((z): z is Zone => Boolean(z))

/** The 24 (service, zone) pairs. */
export const focusPairs = () => FOCUS_SERVICE_SLUGS.flatMap((slug) => FOCUS_ZONE_KEYS.map((zona) => ({ slug, zona })))

export const serviceZonePath = (slug: string, zona: string) => `/servicios/${slug}/${zona}`

/** Typical jobs people ask for, per focus service. */
const TYPICAL_JOBS: Record<string, string[]> = {
  plomeria: [
    'Arreglo de fugas en llaves, tuberías y sanitarios',
    'Destape de lavamanos, lavaplatos, sanitarios y desagües',
    'Instalación y cambio de grifería, sanitarios y lavamanos',
    'Revisión de humedades y bajas de presión de agua',
  ],
  electricidad: [
    'Instalación y cambio de tomas, interruptores y lámparas',
    'Instalación de ventiladores de techo y duchas eléctricas',
    'Revisión de tacos o breakers que se disparan',
    'Puntos eléctricos nuevos y revisión del cableado',
  ],
  pintura: [
    'Pintura de paredes y techos interiores',
    'Retoques antes de entregar o recibir un apartamento',
    'Pintura de rejas, puertas y fachadas',
    'Preparación de superficies con humedad o grietas antes de pintar',
  ],
  'limpieza-hogar': [
    'Limpieza general de apartamentos y casas',
    'Limpieza profunda de cocina y baños',
    'Limpieza después de una mudanza o de una obra',
    'Limpieza de vidrios, pisos y zonas comunes del hogar',
  ],
}

export const typicalJobs = (slug: string) => TYPICAL_JOBS[slug] ?? []

/** Where the zone is, without claims about it. */
export function zoneWhere(zone: Zone) {
  return zone.kind === 'municipio'
    ? `${zone.name} es un municipio del Valle de Aburrá, vecino de Medellín`
    : `${zone.name} es una de las comunas de Medellín`
}

export const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

export type FaqItem = { q: string; a: string }

export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  }
}

/**
 * Honest FAQ of a service (optionally in a zone): the price is the service's base price, the partner count
 * only above the public minimum and with the stats switch on, the rest from the claim switches.
 */
export function serviceFaq(o: {
  serviceName: string
  basePrice: number
  /** Verified partners of the service in Medellín */
  medellinPartners: number
  trust: TrustLike
  hasWhatsapp: boolean
  zone?: Zone | null
  /** Zone pages of the service, for the «where» answer */
  zoneNames?: string[]
}): FaqItem[] {
  const svc = o.serviceName.toLowerCase()
  const where = o.zone ? `en ${o.zone.name}` : 'en Medellín'
  const items: FaqItem[] = [
    {
      q: `¿Cuánto cuesta ${svc} ${where}?`,
      a: `El servicio de ${svc} en LoHaggo parte desde ${pesos(o.basePrice)} COP. El valor final depende del trabajo: cada socio te envía su propuesta con precio y tú eliges antes de confirmar.`,
    },
    {
      q: '¿Los socios están verificados?',
      a: o.trust.claims.trust_background_check ? `Sí. ${verificationLong(o.trust)}` : 'Sí. Nuestro equipo verifica la identidad de cada socio.',
    },
  ]
  if (o.trust.claims.trust_real_stats && o.medellinPartners >= STAT_MINIMUMS.verifiedPartners) {
    items.push({
      q: `¿Cuántos socios de ${svc} hay en Medellín?`,
      a: `Hoy hay ${fmtCount(o.medellinPartners)} socios verificados de ${svc} en Medellín y el Valle de Aburrá.`,
    })
  }
  if (o.zone) {
    items.push({
      q: `¿Atienden en ${o.zone.name}?`,
      a: `Sí. ${zoneWhere(o.zone)}. Al pedir indicas tu dirección y los socios que atienden la zona te envían su propuesta.`,
    })
  } else if (o.zoneNames?.length) {
    items.push({
      q: `¿En qué zonas atienden ${svc}?`,
      a: `En Medellín y el Valle de Aburrá, según la cobertura de cada socio; por ejemplo ${o.zoneNames.join(', ')}. Al pedir indicas tu dirección y los socios que atienden la zona te envían su propuesta.`,
    })
  }
  items.push({ q: '¿Cómo pago el servicio?', a: clientPayment(o.trust) })
  items.push({
    q: `¿Cómo pido ${svc}?`,
    a: o.hasWhatsapp
      ? 'Crea la solicitud en la web o escríbenos por WhatsApp y la creamos por ti. Luego recibes las propuestas de los socios y eliges.'
      : 'Crea la solicitud en la web en pocos pasos. Luego recibes las propuestas de los socios y eliges.',
  })
  return items
}
