/**
 * Local SEO landings of service × zone (/servicios/[slug]/[zona]): the focus services and zones, and the
 * template texts. Written by hand (no AI) and without facts we can't back: only the service's typical jobs
 * and where the zone is. Pure.
 */
import { zoneByKey, type Zone } from '@/lib/geo/zones'
import { STAT_MINIMUMS, fmtCount } from '@/lib/public/claims'
import { clientPayment, verificationLong, type TrustLike } from '@/lib/public/copy'

/** The four services of the first landings: the ones the city page lists zone by zone. */
export const CORE_SERVICE_SLUGS = ['plomeria', 'electricidad', 'pintura', 'limpieza-hogar'] as const
/**
 * Every service that gets a landing per zone («plomero en El Poblado»). A landing exists only while the service has
 * verified partners (otherwise 404 and out of the sitemap), so a service without partners costs nothing.
 */
export const FOCUS_SERVICE_SLUGS = [
  ...CORE_SERVICE_SLUGS,
  'cerrajeria', 'carpinteria', 'jardineria', 'fumigacion', 'reparacion-aires', 'reparacion-neveras', 'reparacion-lavadoras', 'reparacion-electrodomesticos', 'herreria', 'impermeabilizacion',
] as const
export const FOCUS_ZONE_KEYS = ['el-poblado', 'laureles', 'envigado', 'belen', 'sabaneta', 'bello', 'itagui', 'robledo', 'la-america', 'castilla'] as const

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

Object.assign(TYPICAL_JOBS, {
  cerrajeria: [
    'Apertura de puertas y cerraduras cuando te quedaste sin llaves',
    'Cambio e instalación de cerraduras y guardas',
    'Copia de llaves y reparación de chapas',
    'Revisión de la seguridad de puertas y ventanas',
  ],
  carpinteria: [
    'Muebles a la medida: closets, cocinas, bibliotecas',
    'Reparación de puertas, marcos y muebles de madera',
    'Instalación de pisos, zócalos y divisiones en madera',
    'Ajuste y restauración de muebles que ya tienes',
  ],
  jardineria: [
    'Poda de plantas, setos y árboles pequeños',
    'Diseño y siembra de jardines y materos',
    'Mantenimiento mensual de jardines y zonas verdes',
    'Instalación de sistemas de riego y abono',
  ],
  fumigacion: [
    'Control de cucarachas, hormigas y roedores en casas y apartamentos',
    'Fumigación de zancudos y de plagas en jardines',
    'Desinfección de espacios después de una plaga o mudanza',
    'Planes de mantenimiento para evitar que vuelvan las plagas',
  ],
  'reparacion-aires': [
    'Mantenimiento y limpieza de aires acondicionados',
    'Reparación de fugas de gas y fallas de enfriamiento',
    'Instalación y traslado de equipos',
    'Revisión de ruidos, goteos y consumo de energía',
  ],
  'reparacion-neveras': [
    'Neveras que no enfrían o enfrían de más',
    'Cambio de empaques, termostatos y motores',
    'Revisión de ruidos y de goteos de agua',
    'Mantenimiento para alargar la vida del electrodoméstico',
  ],
  'reparacion-lavadoras': [
    'Lavadoras que no centrifugan, no desagotan o no encienden',
    'Cambio de bombas, correas y rodamientos',
    'Revisión de fugas de agua y ruidos fuertes',
    'Mantenimiento de lavadoras y lavasecadoras',
  ],
  'reparacion-electrodomesticos': [
    'Reparación de neveras, lavadoras, estufas y hornos',
    'Diagnóstico de fallas eléctricas en electrodomésticos',
    'Cambio de repuestos con garantía del socio',
    'Mantenimiento preventivo para evitar daños mayores',
  ],
  herreria: [
    'Rejas, puertas y ventanas de seguridad a la medida',
    'Soldadura y reparación de estructuras metálicas',
    'Barandas, escaleras y portones',
    'Mantenimiento y pintura de elementos metálicos',
  ],
  impermeabilizacion: [
    'Impermeabilización de terrazas, cubiertas y techos',
    'Solución de humedades y filtraciones en paredes',
    'Sellado de juntas, canales y bajantes',
    'Revisión antes de la temporada de lluvias',
  ],
})

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
